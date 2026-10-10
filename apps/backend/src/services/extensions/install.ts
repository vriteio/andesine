import { type ExtensionStateResult } from "@andesine/contracts/extensions";
import { extensions } from "@andesine/server/database";
import { config } from "#backend/lib/config";
import { toExtensionStateResult } from "#backend/lib/extensions/state";
import { withAuthorization } from "#backend/lib/policy";
import { canGrantExtensionPermission } from "#backend/lib/policy/delegation-permissions";
import { ORPCError } from "@orpc/server";
import { and, count, eq, isNull } from "drizzle-orm";
import {
  getManifestGrant,
  resolveDisabledReason,
  getLatestVersion,
  getDeclaredViews,
  syncElementViews
} from "@andesine/server/extensions";
import { writeConfiguration, type ConfigurationInput } from "#backend/lib/extensions/configuration";
import { transitionExtension } from "#backend/lib/extensions/lifecycle";

interface InstallInput extends Partial<ConfigurationInput> {
  name: string;
}

/** Installs the latest registry version; missing required configuration leaves it disabled. */
const install = withAuthorization<InstallInput, undefined, ExtensionStateResult>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const [installed] = await database
      .select({ count: count() })
      .from(extensions)
      .where(and(eq(extensions.workspaceID, workspaceID), isNull(extensions.uninstalledAt)));
    const [existing] = await database
      .select({ development: extensions.development })
      .from(extensions)
      .where(
        and(
          eq(extensions.workspaceID, workspaceID),
          eq(extensions.name, input.name),
          isNull(extensions.uninstalledAt)
        )
      );
    const version = await getLatestVersion(database, input.name);

    if (installed.count >= config.MAX_EXTENSIONS_PER_WORKSPACE) {
      throw new ORPCError("FORBIDDEN", {
        message: `A workspace can have at most ${config.MAX_EXTENSIONS_PER_WORKSPACE} extensions`
      });
    }

    // Other members' development extensions are not visible, so the conflict names them.
    if (existing) {
      throw new ORPCError("CONFLICT", {
        message: existing.development
          ? "A member develops an extension with this name"
          : "The extension is installed"
      });
    }

    if (!version) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

    const { manifest } = version.manifest;
    const grant = getManifestGrant(manifest);
    const missingPermissions = grant.permissions.filter((permission) => {
      return !canGrantExtensionPermission(auth, permission);
    });

    if (missingPermissions.length) {
      throw new ORPCError("FORBIDDEN", {
        message: `You cannot grant these permissions: ${missingPermissions.join(", ")}`
      });
    }

    // Created inactive; the transition activates it once its configuration is written.
    const [extension] = await database
      .insert(extensions)
      .values({
        workspaceID,
        name: input.name,
        version: version.version,
        ...grant,
        disabledReason: "configuration_required"
      })
      .returning();

    await writeConfiguration(database, extension.id, manifest.configuration, {
      values: input.values ?? {},
      secrets: input.secrets
    });
    await syncElementViews(database, extension, await getDeclaredViews(database, extension));

    const updated = await transitionExtension(database, extension, {
      event: "extension.installed",
      set: { disabledReason: await resolveDisabledReason(database, extension) }
    });

    return toExtensionStateResult(updated);
  }
);

export { install };
