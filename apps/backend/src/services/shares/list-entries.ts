import { entries, entryShares } from "@andesine/server/database";
import { DEFAULT_PAGE_SIZE } from "@andesine/contracts/limits";
import { type ShareKind } from "@andesine/contracts/entities";
import { toEntryID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gt, ilike, inArray, isNull, or } from "drizzle-orm";
import { type Page, type PageInput } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { isShareableEntry, type ListedShare, listEntryShares } from "#backend/lib/shares";

interface ListSharedEntriesInput extends PageInput {
  kind?: ShareKind;
  search?: string;
}
interface SharedEntry {
  id: string;
  name: string;
  shares: ListedShare[];
}

const listSharedEntries = withAuthorization<ListSharedEntriesInput, undefined, Page<SharedEntry>>(
  { actions: () => ({ entries: [] }), tree: true },
  async ({ authorization, database, input, workspaceID }) => {
    const limit = input.limit ?? DEFAULT_PAGE_SIZE;
    const pattern = input.search && `%${input.search.replace(/[\\%_]/g, "\\$&")}%`;
    const selectSharedEntryIDs = (emailPattern?: string) => {
      return database
        .select({ id: entryShares.entryID })
        .from(entryShares)
        .where(
          and(
            eq(entryShares.workspaceID, workspaceID),
            input.kind ? eq(entryShares.kind, input.kind) : undefined,
            emailPattern ? ilike(entryShares.email, emailPattern) : undefined
          )
        );
    };
    const filters = [
      eq(entries.workspaceID, workspaceID),
      isNull(entries.deletedAt),
      inArray(entries.id, selectSharedEntryIDs()),
      isShareableEntry(authorization)
    ];

    if (pattern) {
      filters.push(
        or(ilike(entries.name, pattern), inArray(entries.id, selectSharedEntryIDs(pattern)))!
      );
    }

    if (input.cursor) {
      const cursorID = toUUID(input.cursor);
      const [cursor] = await database
        .select({ name: entries.name })
        .from(entries)
        .where(and(eq(entries.id, cursorID), eq(entries.workspaceID, workspaceID)));

      if (!cursor) throw new ORPCError("BAD_REQUEST", { message: "Cursor entry not found" });

      filters.push(
        or(
          gt(entries.name, cursor.name),
          and(eq(entries.name, cursor.name), gt(entries.id, cursorID))
        )!
      );
    }

    const rows = await database
      .select({ id: entries.id, name: entries.name })
      .from(entries)
      .where(and(...filters))
      .orderBy(asc(entries.name), asc(entries.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    // All kinds, so a removal covers the whole entry.
    const shares = await listEntryShares(
      database,
      workspaceID,
      pageRows.map(({ id }) => id)
    );

    return {
      data: pageRows.map(({ id, name }) => ({
        id: toEntryID(id),
        name,
        shares: shares.filter(({ entryID }) => entryID === toEntryID(id))
      })),
      pagination: {
        hasMore,
        nextCursor: hasMore ? toEntryID(pageRows[pageRows.length - 1].id) : null
      }
    };
  }
);

export { listSharedEntries };
