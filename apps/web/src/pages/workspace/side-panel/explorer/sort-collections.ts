import {
  type PendingPublishingCollectionOverlay,
  type PublishingCollectionOverlay
} from "#web/lib/data";

interface SortExplorerCollectionsInput {
  collectionOverlays: PublishingCollectionOverlay[];
  pendingCollectionOverlays?: PendingPublishingCollectionOverlay[];
  workingCollectionIDs: string[];
}

const sortExplorerCollectionIDs = (input: SortExplorerCollectionsInput): string[] => {
  const collectionIDs = [...input.workingCollectionIDs];
  const overlayIDs = [...input.collectionOverlays]
    .sort((first, second) => {
      return (
        first.order.localeCompare(second.order) ||
        first.collectionID.localeCompare(second.collectionID)
      );
    })
    .map((collection) => collection.collectionID);

  for (const collection of [...(input.pendingCollectionOverlays ?? [])].sort((a, b) => {
    return a.index - b.index || a.collectionID.localeCompare(b.collectionID);
  })) {
    collectionIDs.splice(
      Math.min(collection.index, collectionIDs.length),
      0,
      collection.collectionID
    );
  }

  return [...collectionIDs, ...overlayIDs];
};

export { sortExplorerCollectionIDs };
