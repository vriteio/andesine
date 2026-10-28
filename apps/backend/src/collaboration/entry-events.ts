import { toEntryID, toWorkspaceID } from "@andesine/contracts/primitives";
import { emitEntryEvent, emitPublishingEntryContentUpdates } from "#backend/events";
import { enqueueCurrentEntrySync } from "#backend/lib/queue";

interface StoredEntry {
  contentChanged: boolean;
  contentNormalized: boolean;
  entry: { id: string; workspaceID: string };
  publishingEntry: { entryID: string; matchesPublishedVersion: boolean };
  /** The new title, or null when it did not change. */
  title: string | null;
}

// Open editors reload the entry, e.g. after its stored content changed under them.
const emitEntryContentReset = (workspaceID: string, entryID: string): void => {
  emitEntryEvent(toWorkspaceID(workspaceID), {
    action: "entry:content-reset",
    data: { id: toEntryID(entryID) }
  });
};
const emitStoredEntryUpdates = (stored: StoredEntry): void => {
  if (stored.contentNormalized) emitEntryContentReset(stored.entry.workspaceID, stored.entry.id);

  if (stored.title !== null) {
    emitEntryEvent(toWorkspaceID(stored.entry.workspaceID), {
      action: "entry:update",
      data: {
        id: toEntryID(stored.entry.id),
        name: stored.title
      }
    });
  }

  if (stored.contentChanged) {
    emitPublishingEntryContentUpdates({
      workspaceID: toWorkspaceID(stored.entry.workspaceID),
      entries: [stored.publishingEntry]
    });
  }

  if (stored.contentChanged || stored.title !== null) {
    void enqueueCurrentEntrySync({
      workspaceID: toWorkspaceID(stored.entry.workspaceID),
      entryIDs: [toEntryID(stored.entry.id)]
    });
  }
};

export { emitEntryContentReset, emitStoredEntryUpdates };
export type { StoredEntry };
