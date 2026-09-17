import {
  publishingChannels,
  publishingSnapshotCollections,
  publishingSnapshotEntries,
  publishingSnapshots
} from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { and, eq, inArray, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const snapshotCollectionChildren = alias(
  publishingSnapshotCollections,
  "publishing_snapshot_collection_children"
);

const deletePublishingSnapshots = async (
  database: DatabaseTransaction,
  workspaceID: string,
  snapshotIDs: string[]
): Promise<void> => {
  if (snapshotIDs.length === 0) return;

  const snapshots = await database
    .select({ id: publishingSnapshots.id })
    .from(publishingSnapshots)
    .where(
      and(
        eq(publishingSnapshots.workspaceID, workspaceID),
        inArray(publishingSnapshots.id, snapshotIDs)
      )
    )
    .orderBy(publishingSnapshots.id)
    .for("update");
  const lockedSnapshotIDs = snapshots.map(({ id }) => id);

  if (lockedSnapshotIDs.length === 0) return;

  await database
    .delete(publishingSnapshotEntries)
    .where(
      and(
        eq(publishingSnapshotEntries.workspaceID, workspaceID),
        inArray(publishingSnapshotEntries.snapshotID, lockedSnapshotIDs)
      )
    );

  while (true) {
    const deletedCollections = await database
      .delete(publishingSnapshotCollections)
      .where(
        and(
          eq(publishingSnapshotCollections.workspaceID, workspaceID),
          inArray(publishingSnapshotCollections.snapshotID, lockedSnapshotIDs),
          notExists(
            database
              .select({ collectionID: snapshotCollectionChildren.collectionID })
              .from(snapshotCollectionChildren)
              .where(
                and(
                  eq(
                    snapshotCollectionChildren.snapshotID,
                    publishingSnapshotCollections.snapshotID
                  ),
                  eq(
                    snapshotCollectionChildren.parentID,
                    publishingSnapshotCollections.collectionID
                  )
                )
              )
          )
        )
      )
      .returning({ collectionID: publishingSnapshotCollections.collectionID });

    if (deletedCollections.length === 0) break;
  }

  const [remainingCollection] = await database
    .select({ collectionID: publishingSnapshotCollections.collectionID })
    .from(publishingSnapshotCollections)
    .where(
      and(
        eq(publishingSnapshotCollections.workspaceID, workspaceID),
        inArray(publishingSnapshotCollections.snapshotID, lockedSnapshotIDs)
      )
    )
    .limit(1);

  if (remainingCollection) {
    throw new Error("Publishing snapshot collection hierarchy could not be deleted");
  }

  await database
    .delete(publishingSnapshots)
    .where(
      and(
        eq(publishingSnapshots.workspaceID, workspaceID),
        inArray(publishingSnapshots.id, lockedSnapshotIDs)
      )
    );
};
const deleteWorkspacePublishingSnapshots = async (
  database: DatabaseTransaction,
  workspaceID: string
): Promise<void> => {
  const snapshots = await database
    .select({ id: publishingSnapshots.id })
    .from(publishingSnapshots)
    .where(eq(publishingSnapshots.workspaceID, workspaceID));

  await database
    .update(publishingChannels)
    .set({ currentSnapshotID: null, updatedAt: new Date() })
    .where(eq(publishingChannels.workspaceID, workspaceID));
  await deletePublishingSnapshots(
    database,
    workspaceID,
    snapshots.map(({ id }) => id)
  );
};

export { deletePublishingSnapshots, deleteWorkspacePublishingSnapshots };
