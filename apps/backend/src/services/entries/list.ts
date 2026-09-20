import { loadCurrentContentPaths, type CollectionSelector } from "#backend/lib/content/paths";
import { DEFAULT_PAGE_SIZE } from "#backend/lib/api/limits";
import { toCollectionID, toEntryID, toUUID } from "#backend/lib/primitives";
import { entries, type Entry } from "#backend/db";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { withAuthorization } from "#backend/lib/policy";

interface ListEntriesInput extends CollectionSelector {
  cursor?: string;
  limit?: number;
}
interface ResolvedListEntries {
  scopeID: string | null | undefined;
  paths: Awaited<ReturnType<typeof loadCurrentContentPaths>>;
  cursor?: { collectionID: string | null; rank: string };
}

const listEntries = withAuthorization<
  ListEntriesInput,
  ResolvedListEntries,
  { entries: Array<Entry & { path: string }>; nextCursor: string | null }
>(
  {
    actions: ({ resolved }) => ({
      entries: [
        { action: "entry:read", collectionID: resolved.scopeID },
        ...(resolved.cursor
          ? [
              {
                action: "entry:read" as const,
                collectionID:
                  resolved.cursor.collectionID === resolved.paths.rootID
                    ? null
                    : resolved.cursor.collectionID
              }
            ]
          : [])
      ]
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const paths = await loadCurrentContentPaths(database, workspaceID);
      const scopeID = paths.resolveCollection(input, false);

      if (!input.cursor) return { paths, scopeID };

      const cursorID = toUUID(input.cursor);
      const collectionID = scopeID;
      const cursorFilters = [
        eq(entries.id, cursorID),
        eq(entries.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      ];

      if (collectionID !== undefined)
        cursorFilters.push(
          collectionID
            ? eq(entries.collectionID, collectionID)
            : or(
                isNull(entries.collectionID),
                paths.rootID ? eq(entries.collectionID, paths.rootID) : undefined
              )!
        );

      const [cursor] = await database
        .select({ collectionID: entries.collectionID, rank: entries.rank })
        .from(entries)
        .where(and(...cursorFilters));

      if (!cursor) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Cursor entry not found",
          data: {
            hints: [
              "Start a new listing without cursor and use pagination.nextCursor from that response. Keep the same filters while paging."
            ]
          }
        });
      }

      return { cursor, paths, scopeID };
    },
    tree: true,
    transaction: "atomic"
  },
  async ({ authorization, database, input, resolved, workspaceID }) => {
    const limit = input.limit ?? DEFAULT_PAGE_SIZE;
    const collectionID = resolved.scopeID;
    const filters = [eq(entries.workspaceID, workspaceID), isNull(entries.deletedAt)];

    if (input.cursor && resolved.cursor) {
      const cursorID = toUUID(input.cursor);

      filters.push(
        or(
          lt(entries.rank, resolved.cursor.rank),
          and(eq(entries.rank, resolved.cursor.rank), lt(entries.id, cursorID))
        )!
      );
    }
    if (collectionID !== undefined) {
      filters.push(
        collectionID
          ? eq(entries.collectionID, collectionID)
          : or(
              isNull(entries.collectionID),
              resolved.paths.rootID ? eq(entries.collectionID, resolved.paths.rootID) : undefined
            )!
      );
    } else {
      const accessibleCollectionIDs = authorization.collections.map(({ id }) => toUUID(id));

      filters.push(
        accessibleCollectionIDs.length > 0
          ? or(
              isNull(entries.collectionID),
              inArray(entries.collectionID, accessibleCollectionIDs)
            )!
          : isNull(entries.collectionID)
      );
    }

    const rows = await database
      .select()
      .from(entries)
      .where(and(...filters))
      .orderBy(desc(entries.rank), desc(entries.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    return {
      entries: pageRows.map((entry) => ({
        id: toEntryID(entry.id),
        name: entry.name,
        path: resolved.paths.entryPath(entry.collectionID, entry.name),
        order: entry.rank,
        collectionID: entry.collectionID ? toCollectionID(entry.collectionID) : undefined
      })),
      nextCursor: hasMore ? toEntryID(pageRows[pageRows.length - 1].id) : null
    };
  }
);

export { listEntries };
