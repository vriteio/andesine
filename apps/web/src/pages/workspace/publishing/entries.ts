import {
  getPublishingEntryOverlayID,
  type PublishingChannelContent,
  type PublishingEntryOverlay
} from "#web/lib/data";
import { type PublishingPanelEntryOccurrence } from "./types";

interface CreatePublishingPanelEntryOccurrencesInput {
  collectionID: string;
  content: PublishingChannelContent;
  overlays: PublishingEntryOverlay[];
}

const createPublishingPanelEntryOccurrences = (
  input: CreatePublishingPanelEntryOccurrencesInput
): PublishingPanelEntryOccurrence[] => {
  const workingEntriesByID = new Map(input.content.entries.map((entry) => [entry.entryID, entry]));
  const overlaysByEntryID = new Map(input.overlays.map((overlay) => [overlay.entryID, overlay]));
  const occurrences: PublishingPanelEntryOccurrence[] = input.content.entries
    .filter(({ status }) => status !== "published")
    .map((entry) => {
      const overlay = overlaysByEntryID.get(entry.entryID);
      const accepted = entry.deleted || (entry.status === "pending-removal" && !entry.canPublish);
      const moved = overlay?.reason === "moved";

      return {
        canPublish: entry.canPublish,
        canRevert: entry.canRevert,
        canUnpublish: entry.canUnpublish || Boolean(moved && overlay.canUnpublish),
        deleted: entry.deleted,
        entryID: entry.entryID,
        id: accepted
          ? getPublishingEntryOverlayID({
              entryID: entry.entryID,
              snapshotID: input.content.snapshotID
            })
          : entry.entryID,
        kind: accepted ? "accepted" : "working",
        moved,
        name: entry.name,
        rank: entry.rank,
        status: moved && !accepted ? "changes" : entry.status,
        treeCollectionID: entry.treeCollectionID,
        versionID: entry.versionID
      };
    });

  for (const overlay of input.overlays) {
    if (overlay.publishingCollectionID !== input.collectionID) continue;

    const workingEntry = workingEntriesByID.get(overlay.entryID);
    const rendersWorkingPlacement = Boolean(
      overlay.reason === "moved" &&
      overlay.collectionID &&
      workingEntry &&
      workingEntry.treeCollectionID !== overlay.collectionID
    );

    if (!rendersWorkingPlacement) continue;

    occurrences.push({
      canPublish: false,
      canRevert: Boolean(workingEntry?.canRevert),
      canUnpublish: overlay.canUnpublish,
      deleted: false,
      entryID: overlay.entryID,
      id: getPublishingEntryOverlayID(overlay),
      kind: "accepted",
      moved: true,
      name: overlay.name,
      rank: overlay.order,
      status: "pending-removal",
      treeCollectionID: overlay.collectionID,
      versionID: overlay.versionID
    });
  }

  return occurrences;
};

export { createPublishingPanelEntryOccurrences };
