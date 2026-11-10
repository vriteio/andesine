import { toExtensionID } from "@andesine/contracts/primitives";
import { extensionActiveViews, extensionElementViews, extensions } from "@andesine/server/database";
import { lockManagedExtension } from "#backend/lib/extensions/state";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { getDeclaredViews, isViewHolder, toSelector } from "@andesine/server/extensions";

interface SetElementViewEnabledInput {
  extensionID: string;
  viewID: string;
  enabled: boolean;
  expectedRevision: number;
}
interface SetElementViewEnabledResult {
  revision: number;
  /** Another extension whose view for the element was disabled. */
  replacedExtensionID: string | null;
}

/** Enabling replaces another extension's active view of the element and disables it there. */
const setElementViewEnabled = withAuthorization<
  SetElementViewEnabledInput,
  undefined,
  SetElementViewEnabledResult
>(
  { permissions: { session: ["extensions"] }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const extension = await lockManagedExtension(
      database,
      auth,
      workspaceID,
      input.extensionID,
      input.expectedRevision
    );
    const view = (await getDeclaredViews(database, extension)).find(({ id }) => {
      return id === input.viewID;
    });

    if (!view) throw new ORPCError("NOT_FOUND", { message: "Element view not found" });

    const selector = toSelector(view.element);
    const indexKey = and(
      eq(extensionActiveViews.workspaceID, workspaceID),
      eq(extensionActiveViews.selector, selector)
    );

    let replacedExtensionID: string | null = null;

    await database
      .insert(extensionElementViews)
      .values({ extensionID: extension.id, viewID: view.id, enabled: input.enabled })
      .onConflictDoUpdate({
        target: [extensionElementViews.extensionID, extensionElementViews.viewID],
        set: { enabled: input.enabled, updatedAt: sql`now()` }
      });

    const isClaiming = input.enabled && isViewHolder(extension);

    if (isClaiming) {
      const [holder] = await database.select().from(extensionActiveViews).where(indexKey);

      if (holder && holder.extensionID !== extension.id) {
        await database
          .update(extensions)
          .set({ revision: sql`${extensions.revision} + 1`, updatedAt: sql`now()` })
          .where(eq(extensions.id, holder.extensionID));
        await database
          .update(extensionElementViews)
          .set({ enabled: false, updatedAt: sql`now()` })
          .where(
            and(
              eq(extensionElementViews.extensionID, holder.extensionID),
              eq(extensionElementViews.viewID, holder.viewID)
            )
          );
        await database.delete(extensionActiveViews).where(indexKey);
        replacedExtensionID = toExtensionID(holder.extensionID);
      }

      await database
        .insert(extensionActiveViews)
        .values({ workspaceID, selector, extensionID: extension.id, viewID: view.id })
        .onConflictDoNothing();
    } else if (!input.enabled) {
      await database
        .delete(extensionActiveViews)
        .where(
          and(
            eq(extensionActiveViews.extensionID, extension.id),
            eq(extensionActiveViews.viewID, view.id)
          )
        );
    }

    const [updated] = await database
      .update(extensions)
      .set({ revision: sql`${extensions.revision} + 1`, updatedAt: sql`now()` })
      .where(eq(extensions.id, extension.id))
      .returning({ revision: extensions.revision });

    return { revision: updated.revision, replacedExtensionID };
  }
);

export { setElementViewEnabled };
