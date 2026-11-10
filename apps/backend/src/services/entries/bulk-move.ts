import { entries } from "@andesine/server/database";
import { prepareSchemaMigrationConnections } from "#backend/collaboration";
import { submitSchemaMigration } from "#backend/lib/queue";
import { resolveCollectionTarget, withItemIndex } from "#backend/lib/content";
import { withAuthorization } from "#backend/lib/policy";
import { toCollectionID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { loadCurrentContentPaths } from "@andesine/server/content";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { isDataLossConfirmationError, planEntryMove } from "#backend/lib/content/entry-move";

interface BulkMoveItem {
  id: string;
  order?: string;
  collectionID?: string | null;
  collectionPath?: string;
  collectionSlugPath?: string;
  expectedCollectionID?: string | null;
}
interface BulkMoveEntriesInput {
  items: BulkMoveItem[];
}
interface ResolvedBulkMoveItem {
  sourceCollectionID: string | null;
  destinationCollectionID: string | null;
}

type PlannedMove = Awaited<ReturnType<typeof planEntryMove>>;

const commitBulkMove = withAuthorization<
  BulkMoveEntriesInput,
  ResolvedBulkMoveItem[],
  PlannedMove[]
>(
  {
    actions: ({ resolved }) => ({
      entries: resolved.flatMap(({ sourceCollectionID, destinationCollectionID }) => [
        { action: "entry:move" as const, collectionID: sourceCollectionID },
        { action: "entry:create" as const, collectionID: destinationCollectionID }
      ])
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const ids = input.items.map(({ id }) => toUUID(id));
      const rows = await database
        .select({ id: entries.id, collectionID: entries.collectionID })
        .from(entries)
        .where(
          and(
            inArray(entries.id, ids),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        );
      const sources = new Map(rows.map((row) => [row.id, row.collectionID]));
      const usesPaths = input.items.some((item) => {
        return item.collectionPath !== undefined || item.collectionSlugPath !== undefined;
      });
      const paths = usesPaths ? await loadCurrentContentPaths(database, workspaceID) : undefined;

      return Promise.all(
        input.items.map(async (item, index) => {
          const sourceCollectionID = sources.get(toUUID(item.id));

          if (sourceCollectionID === undefined) {
            throw new ORPCError("NOT_FOUND", { message: `Item ${index}: entry not found` });
          }

          const target = await resolveCollectionTarget(database, workspaceID, item, paths);

          return {
            sourceCollectionID,
            destinationCollectionID: target === undefined ? sourceCollectionID : target
          };
        })
      );
    },
    transaction: "locked-workspace",
    tree: true
  },
  async ({ auth, authorizationScope, input, resolved }) => {
    const moves: PlannedMove[] = [];

    for (const [index, item] of input.items.entries()) {
      const { destinationCollectionID } = resolved[index];
      // Resolved above, so the move doesn't resolve a path again.
      const target = {
        collectionID: destinationCollectionID ? toCollectionID(destinationCollectionID) : null,
        collectionPath: undefined,
        collectionSlugPath: undefined
      };

      try {
        // Authorized above for all items. Without confirmedDataLoss, no move starts a migration.
        moves.push(
          await planEntryMove({ ...item, ...target, auth, skipAuthorization: authorizationScope })
        );
      } catch (error) {
        const data = isDataLossConfirmationError(error)
          ? {
              hints: ["Move entries that need a schema migration one at a time with entries.move."]
            }
          : undefined;

        throw withItemIndex(error, index, input.items.length, data);
      }
    }

    return moves;
  }
);

/**
 * Moves many entries in one workspace lock; all moves apply or none. Moves that need a schema
 * migration aren't supported here, so they fail the call.
 */
const bulkMoveEntries = async (input: Parameters<typeof commitBulkMove>[0]) => {
  const ids = input.items.map(({ id }) => toUUID(id));

  if (new Set(ids).size !== ids.length) {
    throw new ORPCError("BAD_REQUEST", { message: "Move each entry once per call" });
  }

  const moves = await commitBulkMove(input);

  // Open documents reload their new schema structure, after the transaction.
  for (const [index, move] of moves.entries()) {
    await submitSchemaMigration({
      ...move.schemaMigration,
      prepareAffectedContent: () => {
        return prepareSchemaMigrationConnections(
          move.schemaMigration.affectedCollectionIDs,
          move.collectionChanged ? [toEntryID(ids[index])] : []
        );
      },
      workspaceID: input.auth.workspaceID
    });
  }

  return moves;
};

export { bulkMoveEntries };
