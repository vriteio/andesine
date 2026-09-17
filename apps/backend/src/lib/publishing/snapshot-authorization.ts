import {
  type AuthorizedCollectionTree,
  type Database,
  type EntryAuthorizationSource,
  loadEntryAuthorizationSources
} from "#backend/lib/policy";

interface AuthorizedSnapshotRemovalInput {
  authorization: AuthorizedCollectionTree;
  collectionRemovals: string[];
  database: Database;
  entryRemovals: string[];
  workspaceID: string;
}

const loadAuthorizedSnapshotRemovalEntries = async (
  input: AuthorizedSnapshotRemovalInput
): Promise<EntryAuthorizationSource[]> => {
  const entries = await loadEntryAuthorizationSources({
    database: input.database,
    entryIDs: input.entryRemovals,
    includeDeleted: true,
    workspaceID: input.workspaceID
  });

  for (const collectionID of input.collectionRemovals) {
    input.authorization.assertEntryAction(collectionID, "publishing:unpublish");
  }

  input.authorization.assertEntrySources(entries, "publishing:unpublish");

  return entries;
};

export { loadAuthorizedSnapshotRemovalEntries };
