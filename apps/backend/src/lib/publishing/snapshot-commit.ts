import {
  publishingChannels,
  publishingSnapshotCollections,
  publishingSnapshotEntries,
  publishingSnapshots
} from "#backend/db";
import type { db } from "#backend/lib/adapters";
import type { AuthorizedCollectionTree } from "#backend/lib/policy";
import { toCollectionID, toEntryID, toSnapshotID, toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { normalizePublishingChannelCode } from "./channel";
import { getPublishingSnapshotExpiry } from "./snapshot-state";
import {
  assertChangedResources,
  assertManifestStructure,
  assertUniqueOperations,
  type PublishingSnapshotCollectionState,
  type PublishingSnapshotEntryState
} from "./snapshot-validation";

interface PublishingSnapshotCollectionChange {
  collectionID: string;
  name: string;
  parentID: string | null;
  publishedRoot: boolean;
  rank: string;
}
interface PublishingSnapshotEntryChange {
  collectionID: string | null;
  entryID: string;
  rank: string;
  versionID: string;
}
interface CommitPublishingSnapshotInput {
  authorization: AuthorizedCollectionTree;
  channelCode: string;
  collectionChanges?: PublishingSnapshotCollectionChange[];
  collectionRemovals?: string[];
  creatorID?: string;
  entryChanges?: PublishingSnapshotEntryChange[];
  entryRemovals?: string[];
  expectedSnapshotID?: string;
  reason: "publish" | "unpublish";
  subscriptionPlan: string;
  workspaceID: string;
}
interface CommitPublishingSnapshotResult {
  affectedCollectionIDs: string[];
  affectedEntryIDs: string[];
  created: boolean;
  previousSnapshotID: string;
  searchSyncEntryIDs: string[];
  snapshotID: string;
}
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const collectionStatesEqual = (
  previous: PublishingSnapshotCollectionState,
  next: PublishingSnapshotCollectionState
): boolean => {
  return (
    previous.name === next.name &&
    previous.parentID === next.parentID &&
    previous.publishedRoot === next.publishedRoot &&
    previous.rank === next.rank
  );
};
const entryStatesEqual = (
  previous: PublishingSnapshotEntryState,
  next: PublishingSnapshotEntryState
): boolean => {
  return (
    previous.versionID === next.versionID &&
    previous.collectionID === next.collectionID &&
    previous.rank === next.rank
  );
};
const commitPublishingSnapshot = async (
  database: DatabaseTransaction,
  input: CommitPublishingSnapshotInput
): Promise<CommitPublishingSnapshotResult> => {
  const channelCode = normalizePublishingChannelCode(input.channelCode);
  const creatorID = input.creatorID ? toUUID(input.creatorID) : null;
  const expectedSnapshotID = input.expectedSnapshotID
    ? toUUID(input.expectedSnapshotID)
    : undefined;
  const collectionChanges = (input.collectionChanges || []).map((collection) => ({
    collectionID: toUUID(collection.collectionID),
    name: collection.name,
    parentID: collection.parentID ? toUUID(collection.parentID) : null,
    publishedRoot: collection.publishedRoot,
    rank: collection.rank
  }));
  const collectionRemovals = (input.collectionRemovals || []).map(toUUID);
  const entryChanges = (input.entryChanges || []).map((entry) => ({
    collectionID: entry.collectionID ? toUUID(entry.collectionID) : null,
    entryID: toUUID(entry.entryID),
    rank: entry.rank,
    versionID: toUUID(entry.versionID)
  }));
  const entryRemovals = (input.entryRemovals || []).map(toUUID);
  const now = new Date();
  const expiresAt = getPublishingSnapshotExpiry(input.subscriptionPlan, now);

  assertUniqueOperations(
    collectionChanges.map(({ collectionID }) => collectionID),
    collectionRemovals,
    "collection"
  );
  assertUniqueOperations(
    entryChanges.map(({ entryID }) => entryID),
    entryRemovals,
    "entry"
  );

  const [channel] = await database
    .select({ id: publishingChannels.id, currentSnapshotID: publishingChannels.currentSnapshotID })
    .from(publishingChannels)
    .where(
      and(
        eq(publishingChannels.workspaceID, input.workspaceID),
        eq(publishingChannels.code, channelCode),
        isNull(publishingChannels.deletedAt)
      )
    )
    .for("update");

  if (!channel) throw new ORPCError("NOT_FOUND", { message: "Publishing channel not found" });
  if (!channel.currentSnapshotID) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Publishing channel has no current snapshot"
    });
  }

  if (expectedSnapshotID && expectedSnapshotID !== channel.currentSnapshotID) {
    throw new ORPCError("CONFLICT", { message: "Publishing snapshot changed" });
  }

  const [currentSnapshot] = await database
    .select({ id: publishingSnapshots.id })
    .from(publishingSnapshots)
    .where(
      and(
        eq(publishingSnapshots.workspaceID, input.workspaceID),
        eq(publishingSnapshots.channelID, channel.id),
        eq(publishingSnapshots.id, channel.currentSnapshotID),
        isNull(publishingSnapshots.supersededAt),
        isNull(publishingSnapshots.expiresAt)
      )
    )
    .for("update");

  if (!currentSnapshot) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Current publishing snapshot is unavailable"
    });
  }

  const [currentCollections, currentEntries] = await Promise.all([
    database
      .select({
        collectionID: publishingSnapshotCollections.collectionID,
        name: publishingSnapshotCollections.name,
        parentID: publishingSnapshotCollections.parentID,
        publishedRoot: publishingSnapshotCollections.publishedRoot,
        rank: publishingSnapshotCollections.rank
      })
      .from(publishingSnapshotCollections)
      .where(eq(publishingSnapshotCollections.snapshotID, currentSnapshot.id))
      .orderBy(asc(publishingSnapshotCollections.collectionID)),
    database
      .select({
        collectionID: publishingSnapshotEntries.collectionID,
        entryID: publishingSnapshotEntries.entryID,
        publishedAt: publishingSnapshotEntries.publishedAt,
        publisherID: publishingSnapshotEntries.publisherID,
        rank: publishingSnapshotEntries.rank,
        versionID: publishingSnapshotEntries.versionID
      })
      .from(publishingSnapshotEntries)
      .where(eq(publishingSnapshotEntries.snapshotID, currentSnapshot.id))
      .orderBy(asc(publishingSnapshotEntries.entryID))
  ]);
  const collectionsByID = new Map(
    currentCollections.map((collection) => [collection.collectionID, collection])
  );
  const entriesByID = new Map(currentEntries.map((entry) => [entry.entryID, entry]));
  const changedCollectionStates: PublishingSnapshotCollectionState[] = [];
  const changedEntryStates: PublishingSnapshotEntryState[] = [];
  const affectedCollectionIDs = new Set<string>();
  const affectedEntryIDs = new Set<string>();

  for (const collectionID of collectionRemovals) {
    if (collectionsByID.delete(collectionID)) affectedCollectionIDs.add(collectionID);
  }

  for (const collection of collectionChanges) {
    const previous = collectionsByID.get(collection.collectionID);

    if (previous && collectionStatesEqual(previous, collection)) continue;

    input.authorization.assertEntryAction(collection.collectionID, "publishing:publish");
    collectionsByID.set(collection.collectionID, collection);
    changedCollectionStates.push(collection);
    affectedCollectionIDs.add(collection.collectionID);
  }

  for (const entryID of entryRemovals) {
    if (entriesByID.delete(entryID)) affectedEntryIDs.add(entryID);
  }

  for (const entry of entryChanges) {
    const previous = entriesByID.get(entry.entryID);
    const next = { ...entry, publishedAt: now, publisherID: creatorID };

    if (previous && entryStatesEqual(previous, next)) continue;

    entriesByID.set(entry.entryID, next);
    changedEntryStates.push(next);
    affectedEntryIDs.add(entry.entryID);
  }

  const nextCollections = [...collectionsByID.values()];
  const nextEntries = [...entriesByID.values()];

  assertManifestStructure(nextCollections, nextEntries);
  await assertChangedResources(
    database,
    input.workspaceID,
    nextCollections,
    changedCollectionStates,
    changedEntryStates
  );

  if (affectedCollectionIDs.size === 0 && affectedEntryIDs.size === 0) {
    return {
      affectedCollectionIDs: [],
      affectedEntryIDs: [],
      created: false,
      previousSnapshotID: toSnapshotID(currentSnapshot.id),
      searchSyncEntryIDs: [],
      snapshotID: toSnapshotID(currentSnapshot.id)
    };
  }

  const [snapshot] = await database
    .insert(publishingSnapshots)
    .values({
      workspaceID: input.workspaceID,
      channelID: channel.id,
      creatorID,
      reason: input.reason
    })
    .returning({ id: publishingSnapshots.id });

  if (nextCollections.length > 0) {
    await database.insert(publishingSnapshotCollections).values(
      nextCollections.map((collection) => ({
        workspaceID: input.workspaceID,
        snapshotID: snapshot.id,
        ...collection
      }))
    );
  }

  if (nextEntries.length > 0) {
    await database.insert(publishingSnapshotEntries).values(
      nextEntries.map((entry) => ({
        workspaceID: input.workspaceID,
        snapshotID: snapshot.id,
        ...entry
      }))
    );
  }

  await database
    .update(publishingSnapshots)
    .set({ supersededAt: now, expiresAt })
    .where(eq(publishingSnapshots.id, currentSnapshot.id));
  await database
    .update(publishingChannels)
    .set({ currentSnapshotID: snapshot.id, updatedAt: now })
    .where(eq(publishingChannels.id, channel.id));

  return {
    affectedCollectionIDs: [...affectedCollectionIDs].map(toCollectionID),
    affectedEntryIDs: [...affectedEntryIDs].map(toEntryID),
    created: true,
    previousSnapshotID: toSnapshotID(currentSnapshot.id),
    // Every retained entry must be indexed with the new snapshot ID; removed entries need cleanup.
    searchSyncEntryIDs: [...new Set([...entriesByID.keys(), ...affectedEntryIDs])].map(toEntryID),
    snapshotID: toSnapshotID(snapshot.id)
  };
};

export { commitPublishingSnapshot };
export type {
  CommitPublishingSnapshotInput,
  CommitPublishingSnapshotResult,
  PublishingSnapshotCollectionChange,
  PublishingSnapshotEntryChange
};
