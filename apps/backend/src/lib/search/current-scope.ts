import { entries, type DatabaseTransaction as Database } from "@andesine/server/database";
import { type SearchDocument } from "@andesine/server/search";
import type { AuthorizedCollectionTree } from "#backend/lib/policy";
import { toEntryID, toUUID } from "@andesine/contracts/primitives";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { SearchDocumentAuthorizer } from "./retrieval";

const createDocumentAuthorizer = (
  authorization: AuthorizedCollectionTree,
  database: Database,
  workspaceID: string
): SearchDocumentAuthorizer => {
  return async (documents: SearchDocument[]): Promise<Set<string>> => {
    if (documents.length === 0) return new Set();

    const rows = await database
      .select({ collectionID: entries.collectionID, entryID: entries.id })
      .from(entries)
      .where(
        and(
          eq(entries.workspaceID, workspaceID),
          inArray(
            entries.id,
            documents.map(({ entryID }) => toUUID(entryID))
          ),
          isNull(entries.deletedAt)
        )
      );
    const allowedEntryIDs = new Set(
      rows
        .filter(({ collectionID }) => authorization.canEntry(collectionID, "entry:read"))
        .map(({ entryID }) => toEntryID(entryID))
    );

    return new Set(
      documents.filter(({ entryID }) => allowedEntryIDs.has(entryID)).map(({ id }) => id)
    );
  };
};

export { createDocumentAuthorizer };
