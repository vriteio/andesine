import type { PublishingSnapshotCollectionChange } from "./snapshot-commit";
import { resolveSnapshotEntryRanks } from "./snapshot-entry-order";

interface WorkingCollectionPosition {
  id: string;
  parentID: string | null;
  publishingEnabled: boolean;
  rank: string;
}
interface ResolveSnapshotCollectionRanksInput {
  acceptedCollections: PublishingSnapshotCollectionChange[];
  collectionChanges: PublishingSnapshotCollectionChange[];
  selectedCollectionIDs: string[];
  workingCollections: WorkingCollectionPosition[];
}

const resolveSnapshotCollectionRanks = (
  input: ResolveSnapshotCollectionRanksInput
): Map<string, string> => {
  const workingByID = new Map(
    input.workingCollections.map((collection) => [collection.id, collection])
  );
  const changesByID = new Map(
    input.collectionChanges.map((collection) => [collection.collectionID, collection])
  );
  const selectedIDs = new Set(input.selectedCollectionIDs);
  const acceptedByID = new Map(
    input.acceptedCollections.map((collection) => [
      collection.collectionID,
      { entryID: collection.collectionID, collectionID: collection.parentID, rank: collection.rank }
    ])
  );
  const siblingsByParentID = new Map<string | null, WorkingCollectionPosition[]>();
  const resolvedRanks = new Map<string, string>();

  for (const collection of input.workingCollections) {
    const siblings = siblingsByParentID.get(collection.parentID) || [];

    siblings.push(collection);
    siblingsByParentID.set(collection.parentID, siblings);
  }

  // Roots in different draft folders share snapshot rank space, but are not ordering anchors.
  for (const siblings of siblingsByParentID.values()) {
    const selectedEntryIDs = siblings.filter(({ id }) => selectedIDs.has(id)).map(({ id }) => id);

    if (selectedEntryIDs.length === 0) continue;

    const workingEntries = siblings.map((collection) => {
      let parent = collection.parentID ? workingByID.get(collection.parentID) : undefined;
      let hasPublishingAncestor = false;

      while (parent) {
        hasPublishingAncestor ||= parent.publishingEnabled;
        parent = parent.parentID ? workingByID.get(parent.parentID) : undefined;
      }

      const publishedRoot = collection.publishingEnabled && !hasPublishingAncestor;

      return {
        entryID: collection.id,
        collectionID: publishedRoot ? null : collection.parentID,
        rank: collection.rank
      };
    });
    const ranks = resolveSnapshotEntryRanks({
      acceptedEntries: [...acceptedByID.values()],
      selectedEntryIDs,
      workingEntries
    });

    for (const [collectionID, rank] of ranks) {
      resolvedRanks.set(collectionID, rank);
      acceptedByID.set(collectionID, {
        entryID: collectionID,
        collectionID: changesByID.get(collectionID)!.parentID,
        rank
      });
    }
  }

  return resolvedRanks;
};

export { resolveSnapshotCollectionRanks };
