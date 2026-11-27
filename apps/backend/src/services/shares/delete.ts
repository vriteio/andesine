import { entries, entryShares } from "@andesine/server/database";
import { toEntryID, toUUID } from "@andesine/contracts/primitives";
import { and, eq, inArray } from "drizzle-orm";
import { withAuthorization } from "#backend/lib/policy";
import { removeUnusedVisitors } from "#backend/lib/shares";

interface DeletedShare {
  id: string;
  entryID: string;
  collectionID: string | null;
}

/** Visitors with comments stay, without access, so the comments keep their names. */
const deleteShares = withAuthorization<{ ids: string[] }, DeletedShare[]>(
  {
    actions: ({ resolved }) => ({
      entries: resolved.map(({ entryID, collectionID }) => ({
        action: "entry:share",
        collectionID,
        entryID
      }))
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const rows = await database
        .select({
          id: entryShares.id,
          entryID: entryShares.entryID,
          collectionID: entries.collectionID
        })
        .from(entryShares)
        .innerJoin(entries, eq(entries.id, entryShares.entryID))
        .where(
          and(
            eq(entryShares.workspaceID, workspaceID),
            inArray(entryShares.id, input.ids.map(toUUID))
          )
        );

      return rows.map((row) => ({ ...row, entryID: toEntryID(row.entryID) }));
    },
    transaction: "atomic",
    tree: true
  },
  async ({ database, resolved, workspaceID }) => {
    if (!resolved.length) return;

    await database.delete(entryShares).where(
      inArray(
        entryShares.id,
        resolved.map(({ id }) => id)
      )
    );
    await removeUnusedVisitors(database, workspaceID);
  }
);

export { deleteShares };
