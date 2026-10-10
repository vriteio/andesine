import { type ExtensionActiveView } from "@andesine/contracts/extensions";
import { toExtensionID } from "@andesine/contracts/primitives";
import { extensionActiveViews, extensionElementViews, extensions } from "@andesine/server/database";
import { toSelector } from "@andesine/server/extensions";
import { db } from "#backend/lib/adapters";
import { config } from "#backend/lib/config";
import { isVisibleExtension, listInstalledExtensions } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { and, eq, inArray, isNull } from "drizzle-orm";

/** The member's own enabled development views replace the registry views of their elements. */
const listActiveViews = withAuthorization<Record<never, never>, undefined, ExtensionActiveView[]>(
  { permissions: { session: true } },
  async ({ auth, workspaceID }) => {
    const isActive = and(
      eq(extensions.workspaceID, workspaceID),
      eq(extensions.enabled, true),
      isNull(extensions.disabledReason),
      isNull(extensions.uninstalledAt)
    );
    const rows = await db
      .select({
        selector: extensionActiveViews.selector,
        extensionID: extensionActiveViews.extensionID,
        viewID: extensionActiveViews.viewID
      })
      .from(extensionActiveViews)
      .innerJoin(extensions, eq(extensions.id, extensionActiveViews.extensionID))
      .where(
        and(
          eq(extensionActiveViews.workspaceID, workspaceID),
          eq(extensions.development, false),
          isActive
        )
      );
    const developed = config.EXTENSIONS_DEVELOPMENT_ENABLED
      ? await listInstalledExtensions(
          db,
          and(isActive, eq(extensions.development, true), isVisibleExtension(auth))
        )
      : [];
    const settings = developed.length
      ? await db
          .select()
          .from(extensionElementViews)
          .where(
            and(
              inArray(
                extensionElementViews.extensionID,
                developed.map(({ extension }) => extension.id)
              ),
              eq(extensionElementViews.enabled, true)
            )
          )
      : [];
    const ownViews = developed.flatMap(({ extension, version }) => {
      return version.manifest.elementViews
        .filter((view) => {
          return settings.some(({ extensionID, viewID }) => {
            return extensionID === extension.id && viewID === view.id;
          });
        })
        .map((view) => ({
          selector: toSelector(view.element),
          extensionID: extension.id,
          viewID: view.id
        }));
    });

    // One view per element: the first development extension in name order wins.
    const uniqueViews = ownViews.filter((view, index) => {
      return ownViews.findIndex(({ selector }) => selector === view.selector) === index;
    });

    return [
      ...rows.filter((row) => !uniqueViews.some(({ selector }) => selector === row.selector)),
      ...uniqueViews
    ].map((row) => ({ ...row, extensionID: toExtensionID(row.extensionID) }));
  }
);

export { listActiveViews };
