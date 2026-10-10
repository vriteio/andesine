import {
  type ExtensionDisabledReason,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions";
import { toExtensionID, toWorkspaceID } from "@andesine/contracts/primitives";
import {
  extensionRegistryVersions,
  extensions,
  workspaces,
  type Database,
  type DatabaseClient,
  type DatabaseTransaction
} from "@andesine/server/database";
import {
  createOutboundEvent,
  createWebhookOperation,
  createWebhookRecorder,
  type WebhookEventData
} from "@andesine/server/webhooks/recording";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type WebhookRetentionPolicy } from "../webhooks/retention";
import { isDeepStrictEqual } from "node:util";
import { getMissingConfiguration } from "./configuration";
import { getExtensionManifest, getExtensionVersion } from "./manifest";
import { compareExtensionVersions, getLatestVersion } from "./versions";
import {
  activateElementViews,
  deactivateElementViews,
  getDeclaredViews,
  isExtensionActive,
  syncElementViews,
  type ExtensionRow
} from "./views";
import { syncExtensionWebhooks } from "./webhooks";

interface ExtensionGrant {
  permissions: ExtensionRow["permissions"];
  backendURL: string | null;
  requests: string[];
}
interface ExtensionTransition {
  /** The action; `getLifecycleEvents` derives the recorded events from it and the new state. */
  event: ExtensionLifecycleEvent;
  /** State columns to write; an unchanged state writes nothing. */
  set: Partial<
    Pick<ExtensionRow, "version" | "enabled" | "disabledReason" | "uninstalledAt"> & ExtensionGrant
  >;
  /** Changed configuration field keys, for `extension.configured`. */
  configuredKeys?: string[];
}
interface UpdatedExtension {
  workspaceID: string;
  extensionID: string;
}
interface ExtensionLifecycleOptions {
  retentionPolicy: WebhookRetentionPolicy;
}
interface ExtensionLifecycle {
  transitionExtension(
    database: DatabaseTransaction,
    extension: ExtensionRow,
    transition: ExtensionTransition
  ): Promise<ExtensionRow>;
  updateExtension(database: DatabaseTransaction, extension: ExtensionRow): Promise<ExtensionRow>;
  /** Registry refreshes apply updates to every installation of the name. */
  updateExtensions(database: Database, name: string): Promise<UpdatedExtension[]>;
}

type ExtensionLifecycleEvent =
  | "extension.installed"
  | "extension.enabled"
  | "extension.disabled"
  | "extension.updated"
  | "extension.configured"
  | "extension.uninstalled";
type ExtensionManifest = ExtensionVersionManifest["manifest"];
type SystemDisabledReason = Exclude<ExtensionDisabledReason, "manual">;

const getManifestGrant = (manifest: ExtensionManifest): ExtensionGrant => {
  return {
    permissions: manifest.permissions,
    backendURL: manifest.backend?.url ?? null,
    requests: manifest.requests
  };
};
/** Added permissions, a changed backend URL, or added request URLs need a manager's approval. */
const needsApproval = (grant: ExtensionGrant, manifest: ExtensionManifest): boolean => {
  const next = getManifestGrant(manifest);
  const isBackendChanged = next.backendURL !== null && next.backendURL !== grant.backendURL;

  return (
    isBackendChanged ||
    next.permissions.some((permission) => !grant.permissions.includes(permission)) ||
    next.requests.some((url) => !grant.requests.includes(url))
  );
};
/** The system reason that stops the extension, by precedence: revoked, approval, configuration. */
const resolveDisabledReason = async (
  database: DatabaseClient,
  extension: ExtensionRow
): Promise<SystemDisabledReason | null> => {
  const version = await getExtensionVersion(database, extension);

  if (!version || version.revoked) return "revoked";

  const { manifest } = version.manifest;

  if (needsApproval(extension, manifest)) return "approval_required";

  const missing = await getMissingConfiguration(database, extension.id, manifest.configuration);

  return missing.length ? "configuration_required" : null;
};
const getLifecycleEvents = (
  previous: ExtensionRow,
  extension: ExtensionRow,
  transition: ExtensionTransition
): WebhookEventData[] => {
  const subject = { kind: "extension", id: toExtensionID(extension.id) } as const;
  const data = { version: extension.version };
  const isActive = isExtensionActive(extension);
  const isBoundary =
    transition.event === "extension.installed" || transition.event === "extension.uninstalled";
  const events: WebhookEventData[] = [];

  if (isBoundary) events.push({ type: transition.event, subject, data } as WebhookEventData);

  if (previous.version !== extension.version) {
    events.push({
      type: "extension.updated",
      subject,
      data: { ...data, previousVersion: previous.version }
    });
  }

  if (transition.event === "extension.configured" && transition.configuredKeys?.length) {
    events.push({
      type: "extension.configured",
      subject,
      data: { ...data, changedFields: transition.configuredKeys }
    });
  }

  if (!isBoundary && isExtensionActive(previous) !== isActive) {
    events.push(
      isActive
        ? { type: "extension.enabled", subject, data }
        : {
            type: "extension.disabled",
            subject,
            data: { ...data, reason: extension.disabledReason ?? "manual" }
          }
    );
  }

  return events;
};
/** Lifecycle operations, bound to the retention policy of the running app (backend or worker). */
const createExtensionLifecycle = (options: ExtensionLifecycleOptions): ExtensionLifecycle => {
  /**
   * Every transition goes through here. Stopping, a version change, or uninstall also bumps the
   * generation, which ends session tokens and pending webhook runs. Call with the workspace locked.
   */
  const transitionExtension = async (
    database: DatabaseTransaction,
    extension: ExtensionRow,
    transition: ExtensionTransition
  ): Promise<ExtensionRow> => {
    const next = { ...extension, ...transition.set };
    const isChanged = Object.entries(transition.set).some(([key, value]) => {
      return !isDeepStrictEqual(extension[key as keyof ExtensionRow], value);
    });
    const wasActive = isExtensionActive(extension);
    const isActive = isExtensionActive(next);
    const isVersionChanged = next.version !== extension.version;
    const isStopped = (wasActive && !isActive) || isVersionChanged || Boolean(next.uninstalledAt);

    let updated = extension;

    if (isChanged) {
      [updated] = await database
        .update(extensions)
        .set({
          ...transition.set,
          revision: sql`${extensions.revision} + 1`,
          generation: isStopped ? sql`${extensions.generation} + 1` : extensions.generation,
          updatedAt: sql`now()`
        })
        .where(eq(extensions.id, extension.id))
        .returning();
    }

    if (isVersionChanged) {
      await deactivateElementViews(database, updated.id);
      await syncElementViews(database, updated, await getDeclaredViews(database, updated));
    } else if (isActive && !wasActive) {
      await activateElementViews(database, updated, await getDeclaredViews(database, updated));
    } else if (wasActive && !isActive) {
      await deactivateElementViews(database, updated.id);
    }

    await syncExtensionWebhooks(database, {
      extension: updated,
      manifest: await getExtensionManifest(database, updated),
      stopped: isChanged && isStopped
    });

    const events = getLifecycleEvents(extension, updated, transition);

    if (events.length) {
      const operation = createWebhookOperation(toWorkspaceID(updated.workspaceID));
      const recorder = await createWebhookRecorder({
        retentionPolicy: options.retentionPolicy,
        database,
        operation
      });

      await recorder.record(
        events.map((event) => ({
          event: createOutboundEvent(operation, `${updated.id}:${updated.revision}`, event),
          resources: []
        }))
      );
    }

    return updated;
  };
  const getInstallableVersion = async (
    database: DatabaseClient,
    name: string,
    version: string | null
  ): Promise<typeof extensionRegistryVersions.$inferSelect | null> => {
    if (!version) return null;

    const [row] = await database
      .select()
      .from(extensionRegistryVersions)
      .where(
        and(
          eq(extensionRegistryVersions.name, name),
          eq(extensionRegistryVersions.version, version),
          isNull(extensionRegistryVersions.revokedAt)
        )
      );

    return row ?? null;
  };
  /**
   * Moves to a newer version or a revoked version's replacement, else disables it as `revoked`.
   * Grant expansions wait for approval; reductions apply at once. Lock workspace and extension.
   */
  const updateExtension = async (
    database: DatabaseTransaction,
    extension: ExtensionRow
  ): Promise<ExtensionRow> => {
    // Development extensions change only with new builds.
    if (extension.development) return extension;

    const [current] = await database
      .select()
      .from(extensionRegistryVersions)
      .where(
        and(
          eq(extensionRegistryVersions.name, extension.name),
          eq(extensionRegistryVersions.version, extension.version)
        )
      );
    const latest = await getLatestVersion(database, extension.name);
    const isRevoked = !current || current.revokedAt !== null;
    const isNewer = latest && compareExtensionVersions(latest.version, extension.version) > 0;
    const replacement = isRevoked
      ? await getInstallableVersion(database, extension.name, current?.replacementVersion ?? null)
      : null;
    const target = isNewer ? latest : replacement;

    if (target) {
      const { manifest } = target.manifest;
      const grant = needsApproval(extension, manifest) ? {} : getManifestGrant(manifest);
      const next = { ...extension, ...grant, version: target.version };

      return transitionExtension(database, extension, {
        event: "extension.updated",
        set: {
          ...grant,
          version: target.version,
          disabledReason: await resolveDisabledReason(database, next)
        }
      });
    }

    if (!isRevoked) return extension;

    return transitionExtension(database, extension, {
      event: "extension.disabled",
      set: { disabledReason: "revoked" }
    });
  };
  /** Updates every installation of a name, each in its own transaction; returns changed ones. */
  const updateExtensions = async (
    database: Database,
    name: string
  ): Promise<UpdatedExtension[]> => {
    const installations = await database
      .select({ id: extensions.id, workspaceID: extensions.workspaceID })
      .from(extensions)
      .where(
        and(
          eq(extensions.name, name),
          eq(extensions.development, false),
          isNull(extensions.uninstalledAt)
        )
      );
    const updated: UpdatedExtension[] = [];

    for (const installation of installations) {
      const isChanged = await database.transaction(async (transaction) => {
        await transaction
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.id, installation.workspaceID))
          .for("update");

        const [extension] = await transaction
          .select()
          .from(extensions)
          .where(and(eq(extensions.id, installation.id), isNull(extensions.uninstalledAt)))
          .for("update");

        if (!extension) return false;

        return (await updateExtension(transaction, extension)).revision !== extension.revision;
      });

      if (isChanged) {
        updated.push({
          workspaceID: toWorkspaceID(installation.workspaceID),
          extensionID: toExtensionID(installation.id)
        });
      }
    }

    return updated;
  };

  return { transitionExtension, updateExtension, updateExtensions };
};

export { createExtensionLifecycle, getManifestGrant, resolveDisabledReason };
export type {
  ExtensionLifecycle,
  ExtensionLifecycleEvent,
  ExtensionLifecycleOptions,
  ExtensionTransition,
  UpdatedExtension
};
