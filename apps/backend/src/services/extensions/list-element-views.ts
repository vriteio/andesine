import { type ExtensionElementViewSetting } from "@andesine/contracts/extensions";
import { toExtensionID, toUUID } from "@andesine/contracts/primitives";
import { extensionActiveViews, extensionElementViews, extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { isVisibleExtension } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDeclaredViews, isExtensionActive, toSelector } from "@andesine/server/extensions";

interface ListElementViewsInput {
  extensionID: string;
}

/** Enabled views of an active development extension are active for its developer only. */
const listElementViews = withAuthorization<
  ListElementViewsInput,
  undefined,
  ExtensionElementViewSetting[]
>({ permissions: { session: true } }, async ({ auth, input, workspaceID }) => {
  const [extension] = await db
    .select()
    .from(extensions)
    .where(
      and(
        eq(extensions.id, toUUID(input.extensionID)),
        eq(extensions.workspaceID, workspaceID),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth)
      )
    );

  if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  const views = await getDeclaredViews(db, extension);
  const settings = await db
    .select()
    .from(extensionElementViews)
    .where(eq(extensionElementViews.extensionID, extension.id));
  const holders = await db
    .select({
      selector: extensionActiveViews.selector,
      extensionID: extensionActiveViews.extensionID,
      viewID: extensionActiveViews.viewID,
      name: extensions.name
    })
    .from(extensionActiveViews)
    .innerJoin(extensions, eq(extensions.id, extensionActiveViews.extensionID))
    .where(eq(extensionActiveViews.workspaceID, workspaceID));

  return views.map((view) => {
    const holder = holders.find(({ selector }) => selector === toSelector(view.element));
    const isOwn = holder?.extensionID === extension.id && holder.viewID === view.id;
    const enabled = settings.find(({ viewID }) => viewID === view.id)?.enabled ?? false;
    const isProvided = !extension.development && holder && holder.extensionID !== extension.id;

    return {
      viewID: view.id,
      name: view.name,
      element: view.element,
      enabled,
      active: extension.development ? enabled && isExtensionActive(extension) : isOwn,
      provider: isProvided
        ? { extensionID: toExtensionID(holder.extensionID), name: holder.name }
        : null
    };
  });
});

export { listElementViews };
