import { entries, entryShares } from "@andesine/server/database";
import { DEFAULT_PAGE_SIZE } from "@andesine/contracts/limits";
import { toShareID } from "@andesine/contracts/primitives";
import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import { type Page, type PageInput } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { isShareableEntry } from "#backend/lib/shares";

interface IdentifiedVisitor {
  email: string;
  entries: number;
  shareIDs: string[];
}

/** The cursor is the last address. */
const listIdentifiedVisitors = withAuthorization<PageInput, undefined, Page<IdentifiedVisitor>>(
  { actions: () => ({ entries: [] }), tree: true },
  async ({ authorization, database, input, workspaceID }) => {
    const limit = input.limit ?? DEFAULT_PAGE_SIZE;
    const rows = await database
      .select({
        email: entryShares.email,
        entries: count(),
        shareIDs: sql<string[]>`array_agg(${entryShares.id})::text[]`
      })
      .from(entryShares)
      .innerJoin(entries, eq(entries.id, entryShares.entryID))
      .where(
        and(
          eq(entryShares.workspaceID, workspaceID),
          eq(entryShares.kind, "email"),
          isNull(entries.deletedAt),
          isShareableEntry(authorization),
          input.cursor ? gt(entryShares.email, input.cursor) : undefined
        )
      )
      .groupBy(entryShares.email)
      .orderBy(asc(entryShares.email))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);

    return {
      data: pageRows.map((row) => ({
        email: row.email!,
        entries: row.entries,
        shareIDs: row.shareIDs.map(toShareID)
      })),
      pagination: { hasMore, nextCursor: hasMore ? pageRows[pageRows.length - 1].email : null }
    };
  }
);

export { listIdentifiedVisitors };
