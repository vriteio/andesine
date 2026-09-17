import {
  collections,
  entries,
  publishingSnapshotCollections,
  publishingSnapshotEntries
} from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import type {
  PublishingSnapshotCollectionChange,
  PublishingSnapshotEntryChange
} from "./snapshot-commit";
import { resolvePublishingSnapshot } from "./snapshot-state";
import { resolveSnapshotEntryRanks } from "./snapshot-entry-order";
import { resolveSnapshotCollectionRanks } from "./snapshot-collection-order";

interface PublishingEntrySelection {
  collectionID: string | null;
  entryID: string;
  rank: string;
  versionID: string;
}
interface ResolveEntrySnapshotChangesInput {
  channelCode: string;
  entries: PublishingEntrySelection[];
  workspaceID: string;
}
interface ResolvedEntrySnapshotChanges {
  collectionChanges: PublishingSnapshotCollectionChange[];
  entryChanges: PublishingSnapshotEntryChange[];
  snapshotID: string;
}
interface WorkingCollection {
  id: string;
  name: string;
  parentID: string | null;
  publishingEnabled: boolean;
  rank: string;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getPublishedCollectionPath = (
  collectionsByID: Map<string, WorkingCollection>,
  collectionID: string | null
): WorkingCollection[] => {
  const path: WorkingCollection[] = [];
  let current = collectionID
    ? collectionsByID.get(collectionID)
    : [...collectionsByID.values()].find(({ parentID }) => parentID === null);
  let publishedRootIndex = -1;

  while (current) {
    path.push(current);
    current = current.parentID ? collectionsByID.get(current.parentID) : undefined;
  }

  for (let index = 0; index < path.length; index += 1) {
    if (path[index].publishingEnabled) publishedRootIndex = index;
  }

  if (publishedRootIndex === -1) {
    throw new ORPCError("BAD_REQUEST", { message: "Publishing is not enabled for this entry" });
  }

  return path.slice(0, publishedRootIndex + 1).reverse();
};
const resolveEntrySnapshotChanges = async (
  database: DatabaseTransaction,
  input: ResolveEntrySnapshotChangesInput
): Promise<ResolvedEntrySnapshotChanges> => {
  const snapshot = await resolvePublishingSnapshot(database, input.workspaceID, {
    channelCode: input.channelCode
  });
  const [workingCollections, acceptedCollections, acceptedEntries, workingEntries] =
    await Promise.all([
      database
        .select({
          id: collections.id,
          name: collections.name,
          parentID: collections.parentID,
          publishingEnabled: collections.publishingEnabled,
          rank: collections.rank
        })
        .from(collections)
        .where(and(eq(collections.workspaceID, input.workspaceID), isNull(collections.deletedAt))),
      database
        .select({
          collectionID: publishingSnapshotCollections.collectionID,
          name: publishingSnapshotCollections.name,
          parentID: publishingSnapshotCollections.parentID,
          publishedRoot: publishingSnapshotCollections.publishedRoot,
          rank: publishingSnapshotCollections.rank
        })
        .from(publishingSnapshotCollections)
        .where(eq(publishingSnapshotCollections.snapshotID, snapshot.id))
        .orderBy(asc(publishingSnapshotCollections.collectionID)),
      database
        .select({
          collectionID: publishingSnapshotEntries.collectionID,
          entryID: publishingSnapshotEntries.entryID,
          rank: publishingSnapshotEntries.rank
        })
        .from(publishingSnapshotEntries)
        .where(eq(publishingSnapshotEntries.snapshotID, snapshot.id))
        .orderBy(asc(publishingSnapshotEntries.entryID)),
      database
        .select({ collectionID: entries.collectionID, entryID: entries.id, rank: entries.rank })
        .from(entries)
        .where(and(eq(entries.workspaceID, input.workspaceID), isNull(entries.deletedAt)))
    ]);
  const workingCollectionsByID = new Map(
    workingCollections.map((collection) => [collection.id, collection])
  );
  const acceptedCollectionsByID = new Map(
    acceptedCollections.map((collection) => [collection.collectionID, collection])
  );
  const collectionChangesByID = new Map<string, PublishingSnapshotCollectionChange>();

  for (const entry of input.entries) {
    const path = getPublishedCollectionPath(workingCollectionsByID, entry.collectionID);

    for (let index = 0; index < path.length; index += 1) {
      const collection = path[index];
      const accepted = acceptedCollectionsByID.get(collection.id);
      const parentID = index === 0 ? null : path[index - 1].id;
      const moved = !accepted || accepted.parentID !== parentID;

      collectionChangesByID.set(collection.id, {
        collectionID: collection.id,
        name: accepted?.name ?? collection.name,
        parentID,
        publishedRoot: parentID === null,
        rank: moved ? collection.rank : accepted.rank
      });
    }
  }

  const changes = [...collectionChangesByID.values()];
  const collectionRanks = resolveSnapshotCollectionRanks({
    acceptedCollections,
    collectionChanges: changes,
    selectedCollectionIDs: changes
      .filter(({ collectionID, parentID }) => {
        return acceptedCollectionsByID.get(collectionID)?.parentID !== parentID;
      })
      .map(({ collectionID }) => collectionID),
    workingCollections
  });
  const collectionChanges = changes.map((collection) => ({
    ...collection,
    rank: collectionRanks.get(collection.collectionID) ?? collection.rank
  }));
  const entryRanks = resolveSnapshotEntryRanks({
    acceptedEntries,
    selectedEntryIDs: input.entries.map(({ entryID }) => entryID),
    workingEntries
  });
  const entryChanges = input.entries.map((entry) => ({
    ...entry,
    rank: entryRanks.get(entry.entryID)!
  }));

  return { collectionChanges, entryChanges, snapshotID: snapshot.id };
};

export { resolveEntrySnapshotChanges };
export type { PublishingEntrySelection, ResolvedEntrySnapshotChanges };
