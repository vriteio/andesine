import { type ExtensionRuntime } from "@andesine/contracts/extensions";
import { toExtensionID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { toGrant } from "#backend/lib/extensions/catalog";
import { isVisibleExtension, listInstalledExtensions } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { and, eq, isNull } from "drizzle-orm";

/** What the web app needs to run the workspace's active extensions in the member's browser. */
const listRuntime = withAuthorization<Record<never, never>, undefined, ExtensionRuntime[]>(
  { permissions: { session: true } },
  async ({ auth, database, workspaceID }) => {
    const rows = await listInstalledExtensions(
      database,
      and(
        eq(extensions.workspaceID, workspaceID),
        eq(extensions.enabled, true),
        isNull(extensions.disabledReason),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth)
      )
    );

    return rows.map(({ extension, version }) => {
      const { manifest, artifacts } = version;

      return {
        id: toExtensionID(extension.id),
        name: extension.name,
        version: extension.version,
        generation: extension.generation,
        grant: toGrant(extension),
        artifacts: {
          frontend: artifacts.frontend,
          styles: artifacts.styles ?? null,
          icons: artifacts.icons ?? null
        },
        elementViews: manifest.elementViews,
        blockActions: manifest.blockActions,
        panels: manifest.panels
      };
    });
  }
);

export { listRuntime };
