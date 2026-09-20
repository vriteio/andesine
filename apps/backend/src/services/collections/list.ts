import { loadCurrentContentPaths, type CollectionSelector } from "#backend/lib/content/paths";
import { toCollectionID, toUUID } from "#backend/lib/primitives";
import { DEFAULT_PAGE_SIZE } from "#backend/lib/api/limits";
import { type Collection } from "#backend/db";
import { ORPCError } from "@orpc/server";
import { withAuthorization } from "#backend/lib/policy";

interface ListCollectionsInput extends CollectionSelector {
  cursor?: string;
  limit?: number;
}

const listCollections = withAuthorization<
  ListCollectionsInput,
  {
    paths: Awaited<ReturnType<typeof loadCurrentContentPaths>>;
    scopeID: string | null | undefined;
  },
  { collections: Array<Collection & { path: string }>; nextCursor: string | null }
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:read", collectionID: resolved.scopeID }]
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const paths = await loadCurrentContentPaths(database, workspaceID);
      return { paths, scopeID: paths.resolveCollection(input, false) };
    },
    transaction: "atomic",
    tree: true
  },
  async ({ authorization, input, resolved }) => {
    const limit = input.limit ?? DEFAULT_PAGE_SIZE;
    const parentID = resolved.scopeID ? toCollectionID(resolved.scopeID) : authorization.rootID;
    const collectionsByID = new Map(
      authorization.collections.map((collection) => [collection.id, collection])
    );
    const parent = collectionsByID.get(parentID);
    const siblings = (parent?.descendants || []).flatMap((collectionID) => {
      const collection = collectionsByID.get(collectionID);

      return collection ? [collection] : [];
    });
    let startIndex = 0;

    if (input.cursor) {
      const cursorIndex = siblings.findIndex((collection) => collection.id === input.cursor);

      if (cursorIndex === -1) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cursor collection not found",
          data: {
            hints: [
              "Start a new listing without cursor and use pagination.nextCursor from that response. Keep the same filters while paging."
            ]
          }
        });
      }

      startIndex = cursorIndex + 1;
    }

    const rows = siblings.slice(startIndex, startIndex + limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    return {
      collections: pageRows.map((row) => ({
        ...row,
        path: resolved.paths.collectionPath(toUUID(row.id))
      })),
      nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null
    };
  }
);

export { listCollections };
