import { withAuthorization } from "#backend/lib/policy";
import {
  type ListedShare,
  listEntryShares,
  resolveShareEntry,
  type ShareEntry
} from "#backend/lib/shares";

const listShares = withAuthorization<{ entryID: string }, ShareEntry, ListedShare[]>(
  {
    actions: ({ input, resolved }) => ({
      entries: [
        { action: "entry:share", collectionID: resolved.collectionID, entryID: input.entryID }
      ]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveShareEntry(database, workspaceID, input.entryID);
    }
  },
  ({ database, resolved, workspaceID }) => listEntryShares(database, workspaceID, [resolved.id])
);

export { listShares };
