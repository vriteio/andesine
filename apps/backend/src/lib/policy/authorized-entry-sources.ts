import { entries } from "#backend/db";
import { db } from "#backend/lib/adapters";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { EntryAction } from "./actions";
import type { AuthorizedCollectionTree } from "./authorized-collection-tree";

interface EntryAuthorizationSource {
  collectionID?: string | null;
  deletedAt?: Date | null;
  id: string;
}

interface LoadEntryAuthorizationSourcesInput {
  database?: Database;
  entryIDs: string[];
  includeDeleted?: boolean;
  workspaceID: string;
}

interface AuthorizeEntryIDsInput extends LoadEntryAuthorizationSourcesInput {
  action: EntryAction;
  authorization: AuthorizedCollectionTree;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Database = DatabaseTransaction | typeof db;

const loadEntryAuthorizationSources = async (
  input: LoadEntryAuthorizationSourcesInput
): Promise<EntryAuthorizationSource[]> => {
  if (input.entryIDs.length === 0) return [];

  const database = input.database || db;
  const workspaceID = toUUID(input.workspaceID);
  const entryIDs = [...new Set(input.entryIDs.map(toUUID))];
  const filters = [eq(entries.workspaceID, workspaceID), inArray(entries.id, entryIDs)];

  if (!input.includeDeleted) filters.push(isNull(entries.deletedAt));

  const rows = await database
    .select({ id: entries.id, collectionID: entries.collectionID, deletedAt: entries.deletedAt })
    .from(entries)
    .where(and(...filters));

  if (rows.length !== entryIDs.length) {
    throw new ORPCError("NOT_FOUND", { message: "Entry not found" });
  }

  return rows;
};

const filterAuthorizedEntryIDs = async (input: AuthorizeEntryIDsInput): Promise<string[]> => {
  const sources = await loadEntryAuthorizationSources(input);

  return input.authorization.filterEntryIDs(sources, input.action);
};

export { filterAuthorizedEntryIDs, loadEntryAuthorizationSources };
export type { EntryAuthorizationSource };
