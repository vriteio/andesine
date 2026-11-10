import { type ExtensionDetails } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { getManifestGrant } from "@andesine/server/extensions";
import { toExtensionSummary, toGrant, toVersionDetails } from "#backend/lib/extensions/catalog";
import { isVisibleExtension, listInstalledExtensions } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface GetInput {
  extensionID: string;
}

const get = withAuthorization<GetInput, undefined, ExtensionDetails>(
  { permissions: { session: true } },
  async ({ auth, database, input, workspaceID }) => {
    const [row] = await listInstalledExtensions(
      database,
      and(
        eq(extensions.id, toUUID(input.extensionID)),
        eq(extensions.workspaceID, workspaceID),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth)
      )
    );

    if (!row) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

    const { extension, version } = row;
    const isPending = extension.disabledReason === "approval_required";

    return {
      ...toExtensionSummary(extension, version),
      grant: toGrant(extension),
      pendingGrant: isPending ? getManifestGrant(version.manifest) : null,
      details: toVersionDetails(version)
    };
  }
);

export { get };
