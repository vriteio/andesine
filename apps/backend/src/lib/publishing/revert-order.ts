import {
  collections,
  entries,
  publishingSnapshotCollections,
  publishingSnapshotEntries
} from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { and, eq, isNull } from "drizzle-orm";
import type { PublishingRevertPlan } from "./revert-plan";
import { resolveSnapshotEntryRanks } from "./snapshot-entry-order";

interface PublishingRevertRanks {
  collections: Map<string, string>;
  entries: Map<string, string>;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const resolvePublishingRevertRanks = async (
  database: DatabaseTransaction,
  workspaceID: string,
  plan: PublishingRevertPlan
): Promise<PublishingRevertRanks> => {
  const [workingCollections, workingEntries, acceptedCollections, acceptedEntries] =
    await Promise.all([
      database
        .select({
          entryID: collections.id,
          collectionID: collections.parentID,
          rank: collections.rank
        })
        .from(collections)
        .where(and(eq(collections.workspaceID, workspaceID), isNull(collections.deletedAt))),
      database
        .select({ entryID: entries.id, collectionID: entries.collectionID, rank: entries.rank })
        .from(entries)
        .where(and(eq(entries.workspaceID, workspaceID), isNull(entries.deletedAt))),
      database
        .select({
          entryID: publishingSnapshotCollections.collectionID,
          collectionID: publishingSnapshotCollections.parentID,
          rank: publishingSnapshotCollections.rank
        })
        .from(publishingSnapshotCollections)
        .where(eq(publishingSnapshotCollections.snapshotID, plan.snapshotID)),
      database
        .select({
          entryID: publishingSnapshotEntries.entryID,
          collectionID: publishingSnapshotEntries.collectionID,
          rank: publishingSnapshotEntries.rank
        })
        .from(publishingSnapshotEntries)
        .where(eq(publishingSnapshotEntries.snapshotID, plan.snapshotID))
    ]);
  const workingCollectionsByID = new Map(workingCollections.map((item) => [item.entryID, item]));
  const restoredCollections = plan.collectionOperations.filter(
    ({ action }) => action === "restore"
  );
  const collectionOperationsByID = new Map(
    [...restoredCollections, ...plan.dependencyCollectionOperations].map((operation) => [
      operation.collectionID,
      operation
    ])
  );
  const desiredCollectionsByID = new Map(
    acceptedCollections.map((item) => {
      const operation = collectionOperationsByID.get(item.entryID);
      const parentID = operation
        ? operation.parentID
        : item.collectionID || workingCollectionsByID.get(item.entryID)?.collectionID || null;

      return [item.entryID, { ...item, collectionID: parentID }];
    })
  );

  for (const operation of plan.dependencyCollectionOperations) {
    desiredCollectionsByID.set(operation.collectionID, {
      entryID: operation.collectionID,
      collectionID: operation.parentID,
      rank: operation.rank
    });
  }

  const collectionRanks = resolveSnapshotEntryRanks({
    acceptedEntries: workingCollections,
    reserveSelectedRanks: true,
    selectedEntryIDs: [
      ...restoredCollections
        .filter(({ restoreStructure, restoreVisibility }) => restoreStructure || restoreVisibility)
        .map(({ collectionID }) => collectionID),
      ...plan.dependencyCollectionOperations
        .filter(({ restoreStructure, restoreVisibility }) => restoreStructure || restoreVisibility)
        .map(({ collectionID }) => collectionID)
    ],
    workingEntries: [...desiredCollectionsByID.values()]
  });
  const entryRanks = resolveSnapshotEntryRanks({
    acceptedEntries: workingEntries,
    reserveSelectedRanks: true,
    selectedEntryIDs: plan.entryOperations
      .filter(({ action, restoreStructure, restoreVisibility }) => {
        return action === "restore" && (restoreStructure || restoreVisibility);
      })
      .map(({ entryID }) => entryID),
    workingEntries: acceptedEntries
  });

  return {
    collections: new Map([
      ...workingCollections.map(({ entryID, rank }): [string, string] => [entryID, rank]),
      ...collectionRanks
    ]),
    entries: new Map([
      ...workingEntries.map(({ entryID, rank }): [string, string] => [entryID, rank]),
      ...entryRanks
    ])
  };
};

export { resolvePublishingRevertRanks };
