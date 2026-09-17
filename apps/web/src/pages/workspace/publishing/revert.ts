import { type PublishingChannelContent } from "#web/lib/data";
import { type PublishingPanelEntryOccurrence } from "./types";

interface PublishingRevertTarget {
  all: boolean;
  canRevert: boolean;
  collectionIDs: string[];
  count: number;
  entryIDs: string[];
}
interface CreatePublishingRevertTargetInput {
  all: boolean;
  content: PublishingChannelContent;
  entries: PublishingPanelEntryOccurrence[];
  selection: string[];
}

const createPublishingRevertTarget = (
  input: CreatePublishingRevertTargetInput
): PublishingRevertTarget => {
  const occurrencesByID = new Map(input.entries.map((entry) => [entry.id, entry]));
  const selectedIDs = new Set(input.selection);
  const selectedEntryIDs = new Set(
    input.selection.flatMap((id) => {
      const entry = occurrencesByID.get(id);

      return entry ? [entry.entryID] : [];
    })
  );
  const collections = input.content.collections.filter((collection) => {
    return (
      collection.status !== "published" && (input.all || selectedIDs.has(collection.collectionID))
    );
  });
  const entries = input.content.entries.filter((entry) => {
    return entry.status !== "published" && (input.all || selectedEntryIDs.has(entry.entryID));
  });
  const collectionIDs = collections.map(({ collectionID }) => collectionID);
  const entryIDs = entries.map(({ entryID }) => entryID);
  const count = collectionIDs.length + entryIDs.length;

  return {
    all: input.all,
    canRevert:
      count > 0 &&
      collections.every(({ canRevert }) => canRevert) &&
      entries.every(({ canRevert }) => canRevert),
    collectionIDs,
    count,
    entryIDs
  };
};

export { createPublishingRevertTarget };
export type { PublishingRevertTarget };
