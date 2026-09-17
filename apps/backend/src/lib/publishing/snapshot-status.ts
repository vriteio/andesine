interface OrderedChannelItem {
  id: string;
  parentID: string | null;
  rank: string;
}
interface SnapshotCollectionNode {
  collectionID: string;
  parentID: string | null;
}

const getSnapshotSubtreeCollectionIDs = (
  collections: SnapshotCollectionNode[],
  collectionID: string
): Set<string> => {
  const collectionIDs = new Set<string>();

  if (!collections.some((collection) => collection.collectionID === collectionID)) {
    return collectionIDs;
  }

  collectionIDs.add(collectionID);

  let changed = true;

  while (changed) {
    changed = false;

    for (const collection of collections) {
      if (
        collection.parentID &&
        collectionIDs.has(collection.parentID) &&
        !collectionIDs.has(collection.collectionID)
      ) {
        collectionIDs.add(collection.collectionID);
        changed = true;
      }
    }
  }

  return collectionIDs;
};
const getReorderedItemIDs = (
  workingItems: OrderedChannelItem[],
  snapshotItems: OrderedChannelItem[]
): Set<string> => {
  const workingByParent = new Map<string, OrderedChannelItem[]>();
  const snapshotByParent = new Map<string, OrderedChannelItem[]>();
  const reorderedItemIDs = new Set<string>();

  for (const item of workingItems) {
    const parentKey = item.parentID || "root";
    const childItems = workingByParent.get(parentKey) || [];

    childItems.push(item);
    workingByParent.set(parentKey, childItems);
  }

  for (const item of snapshotItems) {
    const parentKey = item.parentID || "root";
    const childItems = snapshotByParent.get(parentKey) || [];

    childItems.push(item);
    snapshotByParent.set(parentKey, childItems);
  }

  for (const [parentKey, workingChildItems] of workingByParent) {
    const snapshotChildItems = snapshotByParent.get(parentKey) || [];
    const workingOrder = workingChildItems
      .sort((left, right) => left.rank.localeCompare(right.rank))
      .map(({ id }) => id);
    const snapshotOrder = snapshotChildItems
      .sort((left, right) => left.rank.localeCompare(right.rank))
      .map(({ id }) => id);

    for (let index = 0; index < workingOrder.length; index += 1) {
      if (workingOrder[index] === snapshotOrder[index]) continue;

      reorderedItemIDs.add(workingOrder[index]);
      if (snapshotOrder[index]) reorderedItemIDs.add(snapshotOrder[index]);
    }
  }

  return reorderedItemIDs;
};

export { getReorderedItemIDs, getSnapshotSubtreeCollectionIDs };
