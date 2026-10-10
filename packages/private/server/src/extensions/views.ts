import { type ExtensionElementView } from "@andesine/contracts/extensions";
import {
  extensionActiveViews,
  extensionElementViews,
  type extensions,
  type DatabaseClient
} from "@andesine/server/database";
import { and, eq, notInArray } from "drizzle-orm";
import { getExtensionManifest } from "./manifest";

type ExtensionRow = typeof extensions.$inferSelect;

const toSelector = (element: string): string => element.toLowerCase();
const isExtensionActive = (extension: ExtensionRow): boolean => {
  return extension.enabled && !extension.disabledReason && !extension.uninstalledAt;
};
/** Whether the extension's views can hold elements in the workspace's active view index. */
const isViewHolder = (extension: ExtensionRow): boolean => {
  return isExtensionActive(extension) && !extension.development;
};
const getDeclaredViews = async (
  database: DatabaseClient,
  extension: ExtensionRow
): Promise<ExtensionElementView[]> => {
  return (await getExtensionManifest(database, extension))?.elementViews ?? [];
};
/**
 * Claims free elements for chosen views; a view whose element is taken becomes not chosen.
 * Development extensions never claim. Call in a locked-workspace transaction.
 */
const activateElementViews = async (
  database: DatabaseClient,
  extension: ExtensionRow,
  views: ExtensionElementView[]
): Promise<void> => {
  if (!isViewHolder(extension)) return;

  const settings = await database
    .select()
    .from(extensionElementViews)
    .where(eq(extensionElementViews.extensionID, extension.id));

  for (const setting of settings.filter(({ enabled }) => enabled)) {
    const view = views.find(({ id }) => id === setting.viewID);

    if (!view) continue;

    const [claimed] = await database
      .insert(extensionActiveViews)
      .values({
        workspaceID: extension.workspaceID,
        selector: toSelector(view.element),
        extensionID: extension.id,
        viewID: view.id
      })
      .onConflictDoNothing()
      .returning();

    if (claimed) continue;

    const [holder] = await database
      .select()
      .from(extensionActiveViews)
      .where(
        and(
          eq(extensionActiveViews.workspaceID, extension.workspaceID),
          eq(extensionActiveViews.selector, toSelector(view.element))
        )
      );

    if (holder?.extensionID !== extension.id) {
      await database
        .update(extensionElementViews)
        .set({ enabled: false })
        .where(
          and(
            eq(extensionElementViews.extensionID, extension.id),
            eq(extensionElementViews.viewID, view.id)
          )
        );
    }
  }
};
const deactivateElementViews = async (
  database: DatabaseClient,
  extensionID: string
): Promise<void> => {
  await database
    .delete(extensionActiveViews)
    .where(eq(extensionActiveViews.extensionID, extensionID));
};
/** Aligns view settings with declared views: removed views lose them, new views start chosen. */
const syncElementViews = async (
  database: DatabaseClient,
  extension: ExtensionRow,
  views: ExtensionElementView[]
): Promise<void> => {
  const viewIDs = views.map(({ id }) => id);

  await database
    .delete(extensionElementViews)
    .where(
      and(
        eq(extensionElementViews.extensionID, extension.id),
        ...(viewIDs.length ? [notInArray(extensionElementViews.viewID, viewIDs)] : [])
      )
    );

  if (viewIDs.length) {
    await database
      .insert(extensionElementViews)
      .values(viewIDs.map((viewID) => ({ extensionID: extension.id, viewID, enabled: true })))
      .onConflictDoNothing();
  }

  await activateElementViews(database, extension, views);
};

export {
  activateElementViews,
  deactivateElementViews,
  getDeclaredViews,
  isExtensionActive,
  isViewHolder,
  syncElementViews,
  toSelector
};
export type { ExtensionRow };
