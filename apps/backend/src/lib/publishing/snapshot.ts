import { getCurrentDocumentContent } from "#backend/collaboration";
import { toEntryID, toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";

const SNAPSHOT_BATCH_SIZE = 20;
const syncEntrySnapshots = async (workspaceID: string, entryIDs: string[]): Promise<void> => {
  for (let index = 0; index < entryIDs.length; index += SNAPSHOT_BATCH_SIZE) {
    await Promise.all(
      entryIDs.slice(index, index + SNAPSHOT_BATCH_SIZE).map((entryID) => {
        return getCurrentDocumentContent(toEntryID(toUUID(entryID)), workspaceID);
      })
    );
  }
};
const assertEntrySnapshotsSynced = (entryIDs: string[], snapshotEntryIDs: string[]): void => {
  const syncedEntryIDs = new Set(snapshotEntryIDs);

  if (entryIDs.some((entryID) => !syncedEntryIDs.has(entryID))) {
    throw new ORPCError("CONFLICT", {
      message: "Collection contents changed while preparing publication. Try again."
    });
  }
};

export { assertEntrySnapshotsSynced, syncEntrySnapshots };
