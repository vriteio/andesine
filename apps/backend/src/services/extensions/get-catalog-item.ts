import { type ExtensionCatalogDetails } from "@andesine/contracts/extensions";
import { toExtensionID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { getLatestVersion, isExtensionActive } from "@andesine/server/extensions";
import { toVersionDetails } from "#backend/lib/extensions/catalog";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface GetCatalogItemInput {
  name: string;
}

/** The latest installable version of a registry extension, for its details and install review. */
const getCatalogItem = withAuthorization<GetCatalogItemInput, undefined, ExtensionCatalogDetails>(
  { permissions: { session: true } },
  async ({ database, input, workspaceID }) => {
    const version = await getLatestVersion(database, input.name);

    if (!version) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

    const [extension] = await database
      .select()
      .from(extensions)
      .where(
        and(
          eq(extensions.workspaceID, workspaceID),
          eq(extensions.name, input.name),
          isNull(extensions.uninstalledAt)
        )
      );

    return {
      ...toVersionDetails(version.manifest),
      installed: extension
        ? {
            id: toExtensionID(extension.id),
            state: isExtensionActive(extension) ? "active" : "disabled"
          }
        : null
    };
  }
);

export { getCatalogItem };
