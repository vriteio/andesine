import { type Entry } from "#web/lib/api";
import {
  getPublishingEntryOverlayID,
  type PendingPublishingEntryOverlay,
  type PublishingEntryOverlay
} from "#web/lib/data";

interface SortExplorerEntriesInput {
  entryOverlays: PublishingEntryOverlay[];
  pendingEntryOverlays?: PendingPublishingEntryOverlay[];
  workingEntries: Entry[];
}

type ExplorerEntry = Entry | PendingPublishingEntryOverlay | PublishingEntryOverlay;

const getID = (entry: ExplorerEntry): string => {
  return "entryID" in entry ? getPublishingEntryOverlayID(entry) : entry.id;
};
const sortExplorerEntryIDs = (input: SortExplorerEntriesInput): string[] => {
  const entries = [
    ...input.workingEntries,
    ...input.entryOverlays,
    ...(input.pendingEntryOverlays ?? [])
  ];

  return entries
    .sort((first, second) => {
      return second.order.localeCompare(first.order) || getID(first).localeCompare(getID(second));
    })
    .map(getID);
};

export { sortExplorerEntryIDs };
