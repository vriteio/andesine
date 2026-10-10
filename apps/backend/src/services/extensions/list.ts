import { type ExtensionSummary } from "@andesine/contracts/extensions";
import { extensions } from "@andesine/server/database";
import { toExtensionSummary } from "#backend/lib/extensions/catalog";
import { isVisibleExtension, listInstalledExtensions } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { and, eq, isNull } from "drizzle-orm";

const list = withAuthorization<Record<never, never>, undefined, ExtensionSummary[]>(
  { permissions: { session: true } },
  async ({ auth, database, workspaceID }) => {
    const rows = await listInstalledExtensions(
      database,
      and(
        eq(extensions.workspaceID, workspaceID),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth)
      )
    );

    return rows.map(({ extension, version }) => toExtensionSummary(extension, version));
  }
);

export { list };
