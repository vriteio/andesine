import {
  isExtensionLifecycleEvent,
  outboundConfigurationType,
  type OutboundConfiguration,
  type OutboundEventName
} from "@andesine/contracts/webhooks";
import {
  RESTRICTED_CONTENT_PERMISSION,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions";
import { toWebhookID, toWorkspaceID } from "@andesine/contracts/primitives";
import {
  webhookEndpointRevisions,
  webhookEndpoints,
  type DatabaseTransaction
} from "@andesine/server/database";
import { generateUUID } from "@andesine/server/primitives";
import { getDeliveryTime, reconcileWebhookConfiguration } from "@andesine/server/webhooks/delivery";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { isExtensionActive, type ExtensionRow } from "./views";

interface SyncExtensionWebhooksInput {
  extension: ExtensionRow;
  manifest: ExtensionVersionManifest["manifest"] | null;
  /** The extension stopped running or changed version: cancel the webhooks' pending runs. */
  stopped: boolean;
}

interface WebhookState {
  enabled: boolean;
  disabledReason: EndpointRow["disabledReason"];
}

type EndpointRow = typeof webhookEndpoints.$inferSelect;

/**
 * Manual and failure disables win. Webhooks without lifecycle events follow the extension; others
 * stay enabled for lifecycle events and get other events only while the extension is active.
 */
const resolveWebhookState = (
  eventTypes: OutboundEventName[],
  isActive: boolean,
  disabledReason: EndpointRow["disabledReason"]
): WebhookState => {
  const followsExtension = !eventTypes.some(isExtensionLifecycleEvent);

  if (disabledReason === "manual" || disabledReason === "failures") {
    return { enabled: false, disabledReason };
  }

  return followsExtension && !isActive
    ? { enabled: false, disabledReason: "extension" }
    : { enabled: true, disabledReason: null };
};

/** The stored configuration of a manifest webhook, with the approved backend URL and grant. */
const getManagedConfiguration = (
  extension: ExtensionRow,
  webhookID: string,
  webhook: ExtensionVersionManifest["manifest"]["webhooks"][string],
  enabled: boolean
): OutboundConfiguration => {
  return outboundConfigurationType.parse({
    name: `${extension.name} · ${webhookID}`.slice(0, 100),
    url: `${extension.backendURL!.replace(/\/+$/, "")}${webhook.path}`,
    enabled,
    eventTypes: webhook.events,
    schemaVersion: 1,
    collections: { mode: "all" },
    channels: webhook.channels.length
      ? { mode: "selected", codes: webhook.channels }
      : { mode: "all" },
    restrictedContent: extension.permissions.includes(RESTRICTED_CONTENT_PERMISSION)
  });
};
const getStoredConfiguration = (endpoint: EndpointRow): OutboundConfiguration => {
  return {
    name: endpoint.name,
    url: endpoint.url,
    enabled: endpoint.enabled,
    eventTypes: endpoint.eventTypes,
    schemaVersion: 1,
    collections: endpoint.collections,
    channels: endpoint.channels,
    restrictedContent: endpoint.restrictedContent
  };
};
const recordRevision = async (
  database: DatabaseTransaction,
  endpoint: Pick<EndpointRow, "workspaceID" | "id" | "revision" | "destinationRevision">,
  configuration: OutboundConfiguration,
  now: Date
): Promise<void> => {
  await database.insert(webhookEndpointRevisions).values({
    workspaceID: endpoint.workspaceID,
    endpointID: endpoint.id,
    revision: endpoint.revision,
    destinationRevision: endpoint.destinationRevision,
    configuration,
    createdAt: now
  });
};
/**
 * Syncs managed webhook rows with the manifest (a new URL is a destination change); there are
 * none without an approved backend URL. Call in the transition's locked-workspace transaction.
 */
const syncExtensionWebhooks = async (
  database: DatabaseTransaction,
  input: SyncExtensionWebhooksInput
): Promise<void> => {
  const { extension, manifest, stopped } = input;
  const workspaceID = toWorkspaceID(extension.workspaceID);
  const webhooks = extension.backendURL ? Object.entries(manifest?.webhooks ?? {}) : [];
  const existing = await database
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.extensionID, extension.id), isNull(webhookEndpoints.deletedAt)))
    .for("update");
  const now = await getDeliveryTime(database);
  const isActive = isExtensionActive(extension);

  for (const [webhookID, webhook] of webhooks) {
    const endpoint = existing.find((row) => row.extensionWebhookID === webhookID);
    const state = resolveWebhookState(webhook.events, isActive, endpoint?.disabledReason ?? null);
    const configuration = getManagedConfiguration(extension, webhookID, webhook, state.enabled);

    if (!endpoint) {
      const [created] = await database
        .insert(webhookEndpoints)
        .values({
          ...configuration,
          id: generateUUID(),
          workspaceID: extension.workspaceID,
          kind: "extension",
          extensionID: extension.id,
          extensionWebhookID: webhookID,
          disabledReason: state.disabledReason,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      await recordRevision(database, created, configuration, now);
      continue;
    }

    const stored = getStoredConfiguration(endpoint);
    const isURLChanged = configuration.url !== stored.url;
    const isRestarted = stopped || isURLChanged || state.enabled !== endpoint.enabled;
    const isUnchanged =
      isDeepStrictEqual(configuration, stored) && state.disabledReason === endpoint.disabledReason;

    if (isUnchanged && !stopped) continue;

    const changed = !isDeepStrictEqual(configuration, stored);
    const revision = endpoint.revision + (changed ? 1 : 0);
    const destinationRevision = endpoint.destinationRevision + (isURLChanged ? 1 : 0);

    if (changed) {
      await recordRevision(
        database,
        { ...endpoint, revision, destinationRevision },
        configuration,
        now
      );
    }

    await database
      .update(webhookEndpoints)
      .set({
        ...configuration,
        disabledReason: state.disabledReason,
        revision,
        destinationRevision,
        executionGeneration: endpoint.executionGeneration + (isRestarted ? 1 : 0),
        ...(isURLChanged && { lastSuccessAt: null }),
        updatedAt: now
      })
      .where(eq(webhookEndpoints.id, endpoint.id));
    await reconcileWebhookConfiguration(database, workspaceID, toWebhookID(endpoint.id));
  }

  for (const endpoint of existing) {
    const isRemoved = !webhooks.some(([webhookID]) => webhookID === endpoint.extensionWebhookID);

    if (!isRemoved) continue;

    const revision = endpoint.revision + 1;

    await recordRevision(
      database,
      { ...endpoint, revision },
      { ...getStoredConfiguration(endpoint), enabled: false },
      now
    );
    await database
      .update(webhookEndpoints)
      .set({
        enabled: false,
        disabledReason: "manual",
        deletedAt: now,
        updatedAt: now,
        revision,
        executionGeneration: endpoint.executionGeneration + 1
      })
      .where(eq(webhookEndpoints.id, endpoint.id));
    await reconcileWebhookConfiguration(database, workspaceID, toWebhookID(endpoint.id));
  }
};
/** A live managed webhook of the extension (its UUID) by manifest webhook ID, or NOT_FOUND. */
const loadExtensionWebhook = async (
  database: DatabaseTransaction,
  extensionID: string,
  webhookID: string
): Promise<EndpointRow> => {
  const [endpoint] = await database
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.extensionID, extensionID),
        eq(webhookEndpoints.extensionWebhookID, webhookID),
        isNull(webhookEndpoints.deletedAt)
      )
    )
    .for("update");

  if (!endpoint) throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });

  return endpoint;
};

export {
  syncExtensionWebhooks,
  loadExtensionWebhook,
  getStoredConfiguration,
  recordRevision,
  resolveWebhookState
};
