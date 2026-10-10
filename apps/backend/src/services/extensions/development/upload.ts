import {
  ExtensionStyleError,
  MAX_EXTENSION_ARTIFACT_SIZE,
  validateExtensionCSS,
  type ExtensionArtifact,
  type ExtensionDevelopmentUpload,
  type ExtensionStateResult,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions";
import { toExtensionID, toUUID } from "@andesine/contracts/primitives";
import {
  extensionDevelopmentVersions,
  extensions,
  type DatabaseTransaction
} from "@andesine/server/database";
import {
  getDeclaredViews,
  getManifestGrant,
  resolveDisabledReason,
  syncElementViews
} from "@andesine/server/extensions";
import { config } from "#backend/lib/config";
import { writeConfiguration } from "#backend/lib/extensions/configuration";
import { transitionExtension } from "#backend/lib/extensions/lifecycle";
import { toExtensionStateResult } from "#backend/lib/extensions/state";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";
import { canGrantDevelopmentPermission } from "#backend/lib/policy/delegation-permissions";
import { ORPCError } from "@orpc/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";

type ExtensionRow = typeof extensions.$inferSelect;

// Each build gets a new version, so a reload restarts the extension like an update.
const BUILD_SUFFIX = /\+dev\.(\d+)$/;

const getNextVersion = (manifestVersion: string, previous?: ExtensionRow): string => {
  const build = Number(BUILD_SUFFIX.exec(previous?.version ?? "")?.[1] ?? 0) + 1;
  const version = `${manifestVersion}+dev.${build}`;

  if (version.length > 64) {
    throw new ORPCError("BAD_REQUEST", { message: "The manifest version is too long" });
  }

  return version;
};
const toArtifact = (extensionID: string, content: string): ExtensionArtifact => {
  const sha256 = createHash("sha256").update(content).digest("hex");
  const size = Buffer.byteLength(content);

  if (size > MAX_EXTENSION_ARTIFACT_SIZE) {
    throw new ORPCError("BAD_REQUEST", { message: "An artifact is larger than 5 MB" });
  }

  return {
    url: `${config.PUBLIC_API_URL}/extensions/development/${toExtensionID(extensionID)}/artifacts/${sha256}`,
    sha256,
    size
  };
};
/** Validates the CSS like the registry build, then stores the build as the extension's version. */
const writeBuild = async (
  database: DatabaseTransaction,
  extensionID: string,
  version: string,
  input: ExtensionDevelopmentUpload
): Promise<void> => {
  const { manifest, artifacts } = input;
  const styles = artifacts.styles || null;
  const icons = artifacts.icons || null;

  try {
    if (styles) validateExtensionCSS(styles, manifest.name);
    if (icons) validateExtensionCSS(icons, manifest.name, "icon");
  } catch (error) {
    if (error instanceof ExtensionStyleError) {
      throw new ORPCError("BAD_REQUEST", { message: error.message });
    }

    throw error;
  }

  const build: ExtensionVersionManifest = {
    manifest,
    sourceCommit: "",
    artifacts: {
      frontend: toArtifact(extensionID, artifacts.frontend),
      ...(styles && { styles: toArtifact(extensionID, styles) }),
      ...(icons && { icons: toArtifact(extensionID, icons) })
    },
    publishedAt: new Date().toISOString()
  };
  const values = { version, manifest: build, frontend: artifacts.frontend, styles, icons };

  await database
    .insert(extensionDevelopmentVersions)
    .values({ extensionID, ...values })
    .onConflictDoUpdate({ target: extensionDevelopmentVersions.extensionID, set: values });
};

/** Installs or reloads a member's development extension, whose grant the member must give. */
const upload = withAuthorization<ExtensionDevelopmentUpload, undefined, ExtensionStateResult>(
  {
    permissions: { session: ["extensions"], oauth: ["extensions"] },
    transaction: "locked-workspace"
  },
  async ({ auth, database, input, workspaceID }) => {
    const { manifest } = input;
    const memberID = toUUID(getUserAuthorization(auth)!.memberID);
    const [existing] = await database
      .select()
      .from(extensions)
      .where(
        and(
          eq(extensions.workspaceID, workspaceID),
          eq(extensions.name, manifest.name),
          isNull(extensions.uninstalledAt)
        )
      )
      .for("update");
    const version = getNextVersion(manifest.version, existing);
    const grant = getManifestGrant(manifest);
    const missingPermissions = grant.permissions.filter((permission) => {
      return !canGrantDevelopmentPermission(auth, permission);
    });

    if (existing && existing.developerID !== memberID) {
      throw new ORPCError("CONFLICT", {
        message: existing.development
          ? "Another member develops this extension"
          : "The extension is installed from the registry"
      });
    }

    // The developer grants the build's permissions, so reloads apply them without an approval.
    if (missingPermissions.length) {
      throw new ORPCError("FORBIDDEN", {
        message: `You cannot grant these permissions: ${missingPermissions.join(", ")}`
      });
    }

    if (existing) {
      await writeBuild(database, existing.id, version, input);

      const next = { ...existing, ...grant, version, enabled: true };
      const updated = await transitionExtension(database, existing, {
        event: "extension.updated",
        set: {
          ...grant,
          version,
          enabled: true,
          disabledReason: await resolveDisabledReason(database, next)
        }
      });

      return toExtensionStateResult(updated);
    }

    const [installed] = await database
      .select({ count: count() })
      .from(extensions)
      .where(and(eq(extensions.workspaceID, workspaceID), isNull(extensions.uninstalledAt)));

    if (installed.count >= config.MAX_EXTENSIONS_PER_WORKSPACE) {
      throw new ORPCError("FORBIDDEN", {
        message: `A workspace can have at most ${config.MAX_EXTENSIONS_PER_WORKSPACE} extensions`
      });
    }

    // Created inactive; the transition activates it once its configuration is written.
    const [extension] = await database
      .insert(extensions)
      .values({
        workspaceID,
        name: manifest.name,
        version,
        development: true,
        developerID: memberID,
        ...grant,
        disabledReason: "configuration_required"
      })
      .returning();

    await writeBuild(database, extension.id, version, input);
    await writeConfiguration(database, extension.id, manifest.configuration, { values: {} });
    await syncElementViews(database, extension, await getDeclaredViews(database, extension));

    const updated = await transitionExtension(database, extension, {
      event: "extension.installed",
      set: { disabledReason: await resolveDisabledReason(database, extension) }
    });

    return toExtensionStateResult(updated);
  }
);

export { upload };
