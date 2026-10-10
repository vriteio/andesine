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

const emitStoredEntryUpdates = (stored: StoredEntry): void => {
  if (stored.contentNormalized) {
    emitEntryEvent(toWorkspaceID(stored.entry.workspaceID), {
      action: "entry:content-reset",
      data: { id: toEntryID(stored.entry.id) }
    });
  }

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

export { emitStoredEntryUpdates };
export type { StoredEntry };
