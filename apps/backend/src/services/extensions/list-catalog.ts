import { type ExtensionCatalogItem } from "@andesine/contracts/extensions";
import { toExtensionID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { getLatestVersions, isExtensionActive } from "@andesine/server/extensions";
import { toPresentation } from "#backend/lib/extensions/catalog";
import { withAuthorization } from "#backend/lib/policy";
import { and, eq, isNull } from "drizzle-orm";

/** The registry's extensions at their latest installable version, with this workspace's state. */
const listCatalog = withAuthorization<Record<never, never>, undefined, ExtensionCatalogItem[]>(
  { permissions: { session: true } },
  async ({ database, workspaceID }) => {
    const versions = await getLatestVersions(database);
    const installed = await database
      .select()
      .from(extensions)
      .where(and(eq(extensions.workspaceID, workspaceID), isNull(extensions.uninstalledAt)));

    return versions.map((version) => {
      const extension = installed.find(({ name }) => name === version.name);

      return {
        ...toPresentation(version.manifest),
        installed: extension
          ? {
              id: toExtensionID(extension.id),
              state: isExtensionActive(extension) ? "active" : "disabled"
            }
          : null
      };
    });
  }
);

export { listCatalog };
