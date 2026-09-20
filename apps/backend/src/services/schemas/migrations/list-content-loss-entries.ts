import { entries, schemaMigrationEntries } from "#backend/db";
import type { SchemaMigrationContentLossEntry } from "#backend/lib/data";
import { DEFAULT_PAGE_SIZE } from "#backend/lib/api/limits";
import { toPage, type Page, type PageInput } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { toCollectionID, toEntryID, toUUID } from "#backend/lib/primitives";
import {
  resolveSchemaMigration,
  type GetSchemaMigrationInput,
  type ResolvedSchemaMigration
} from "#backend/lib/schema/migration/resolve";
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";

interface ListContentLossEntriesInput extends GetSchemaMigrationInput, PageInput {}

const listContentLossEntries = withAuthorization<
  ListContentLossEntriesInput,
  ResolvedSchemaMigration,
  Page<SchemaMigrationContentLossEntry>
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:read", collectionID: resolved.collectionID }]
    }),
    resolve: resolveSchemaMigration,
    tree: true
  },
  async ({ authorization, database, input, resolved, workspaceID }) => {
    const limit = input.limit ?? DEFAULT_PAGE_SIZE;
    const collectionIDs = authorization.collections
      .filter(({ id }) => authorization.canEntry(id, "entry:read"))
      .map(({ id }) => toUUID(id));

    if (resolved.migration.status !== "completed" || !collectionIDs.length)
      return toPage([], limit);

    const rows = await database
      .select({ id: entries.id, collectionID: entries.collectionID, name: entries.name })
      .from(schemaMigrationEntries)
      .innerJoin(
        entries,
        and(
          eq(entries.workspaceID, schemaMigrationEntries.workspaceID),
          eq(entries.id, schemaMigrationEntries.entryID),
          isNull(entries.deletedAt)
        )
      )
      .where(
        and(
          eq(schemaMigrationEntries.workspaceID, workspaceID),
          eq(schemaMigrationEntries.migrationID, resolved.migration.id),
          eq(schemaMigrationEntries.status, "completed"),
          eq(schemaMigrationEntries.contentLost, true),
          inArray(entries.collectionID, collectionIDs),
          input.cursor ? gt(entries.id, toUUID(input.cursor)) : undefined
        )
      )
      .orderBy(asc(entries.id))
      .limit(limit + 1);

    return toPage(
      rows.map((entry) => ({
        id: toEntryID(entry.id),
        collectionID: toCollectionID(entry.collectionID!),
        name: entry.name
      })),
      limit
    );
  }
);

export { listContentLossEntries };
