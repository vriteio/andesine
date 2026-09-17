import {
  collections,
  contents,
  entries,
  entryVersions,
  publishingSnapshotCollections,
  publishingSnapshotEntries
} from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { normalizePublishingChannelCode } from "./channel";
import type {
  LoadPublishingChangeSetInput,
  PublishingChangeSet,
  PublishingChangeSetCollection,
  PublishingChangeSetEntry,
  PublishingChangeStatus,
  PublishingWorkingEntry
} from "./change-set-types";
import { resolvePublishingSnapshot } from "./snapshot-state";
import { getReorderedItemIDs, getSnapshotSubtreeCollectionIDs } from "./snapshot-status";
import { getSubtreeCollectionIDs, isCollectionPublishingEnabled, loadPublishingTree } from "./tree";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const loadPublishingChangeSet = async (
  database: DatabaseTransaction,
  workspaceID: string,
  input: LoadPublishingChangeSetInput,
  workingContentHashes?: ReadonlyMap<string, string>
): Promise<PublishingChangeSet> => {
  const channel = normalizePublishingChannelCode(input.channel);
  const collectionID = toUUID(input.collectionID);
  const expectedSnapshotID = input.expectedSnapshotID
    ? toUUID(input.expectedSnapshotID)
    : undefined;
  const snapshot = await resolvePublishingSnapshot(database, workspaceID, {
    channelCode: channel
  });

  if (expectedSnapshotID && snapshot.id !== expectedSnapshotID) {
    throw new ORPCError("CONFLICT", { message: "Publishing snapshot changed" });
  }

  const [tree, snapshotCollectionRows] = await Promise.all([
    loadPublishingTree(database, workspaceID),
    database
      .select({
        id: publishingSnapshotCollections.collectionID,
        name: publishingSnapshotCollections.name,
        parentID: publishingSnapshotCollections.parentID,
        publishedRoot: publishingSnapshotCollections.publishedRoot,
        rank: publishingSnapshotCollections.rank
      })
      .from(publishingSnapshotCollections)
      .where(eq(publishingSnapshotCollections.snapshotID, snapshot.id))
      .orderBy(
        asc(publishingSnapshotCollections.rank),
        asc(publishingSnapshotCollections.collectionID)
      )
  ]);
  const treeCollectionsByID = new Map(
    tree.collections.map((collection) => [collection.id, collection])
  );
  const publishingCollection = treeCollectionsByID.get(collectionID);
  const snapshotPublishingCollection = snapshotCollectionRows.find((collection) => {
    return collection.id === collectionID && collection.publishedRoot;
  });

  if (!publishingCollection && !snapshotPublishingCollection) {
    throw new ORPCError("NOT_FOUND", { message: "Collection not found" });
  }

  let parent = publishingCollection?.parentID
    ? treeCollectionsByID.get(publishingCollection.parentID)
    : undefined;
  let hasPublishingAncestor = false;

  while (parent) {
    hasPublishingAncestor ||= parent.publishingEnabled;
    parent = parent.parentID ? treeCollectionsByID.get(parent.parentID) : undefined;
  }

  const currentPublishingRoot = Boolean(
    publishingCollection?.publishingEnabled && !hasPublishingAncestor
  );

  if (!currentPublishingRoot && !snapshotPublishingCollection) {
    throw new ORPCError("BAD_REQUEST", { message: "Collection is not a publishing root" });
  }

  const workingCollectionIDs = new Set(
    getSubtreeCollectionIDs(tree, collectionID).filter((id) => {
      return isCollectionPublishingEnabled(tree, id);
    })
  );
  const [workingCollections, entryRows] = await Promise.all([
    database
      .select({
        deletedAt: collections.deletedAt,
        id: collections.id,
        name: collections.name,
        parentID: collections.parentID,
        publishingEnabled: collections.publishingEnabled,
        rank: collections.rank
      })
      .from(collections)
      .where(eq(collections.workspaceID, workspaceID))
      .orderBy(asc(collections.rank), asc(collections.id)),
    database
      .select({
        acceptedCollectionID: publishingSnapshotEntries.collectionID,
        acceptedEntryName: entryVersions.entryName,
        acceptedHash: entryVersions.hash,
        acceptedPublishedAt: publishingSnapshotEntries.publishedAt,
        acceptedRank: publishingSnapshotEntries.rank,
        acceptedSchemaRevisionID: entryVersions.schemaRevisionID,
        acceptedVersionID: publishingSnapshotEntries.versionID,
        collectionID: entries.collectionID,
        deletedAt: entries.deletedAt,
        hash: contents.hash,
        id: entries.id,
        name: entries.name,
        rank: entries.rank,
        schemaRevisionID: contents.schemaRevisionID
      })
      .from(entries)
      .leftJoin(contents, eq(contents.entryID, entries.id))
      .leftJoin(
        publishingSnapshotEntries,
        and(
          eq(publishingSnapshotEntries.entryID, entries.id),
          eq(publishingSnapshotEntries.snapshotID, snapshot.id)
        )
      )
      .leftJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
      .where(
        and(
          eq(entries.workspaceID, workspaceID),
          sql`${entries.deletedAt} is null or ${publishingSnapshotEntries.entryID} is not null`
        )
      )
      .orderBy(asc(entries.rank), asc(entries.id))
  ]);
  const snapshotCollectionIDs = getSnapshotSubtreeCollectionIDs(
    snapshotCollectionRows.map((collection) => ({
      collectionID: collection.id,
      parentID: collection.parentID
    })),
    collectionID
  );
  const workingCollectionsByID = new Map(
    workingCollections.map((collection) => [collection.id, collection])
  );
  const snapshotCollectionsByID = new Map(
    snapshotCollectionRows.map((collection) => [collection.id, collection])
  );
  const comparableCollectionIDs = new Set(
    [...workingCollectionIDs].filter((id) => {
      const working = workingCollectionsByID.get(id);
      const accepted = snapshotCollectionsByID.get(id);
      const workingParentID =
        id === collectionID && currentPublishingRoot ? null : working?.parentID || null;

      return Boolean(
        working &&
        !working.deletedAt &&
        accepted &&
        snapshotCollectionIDs.has(id) &&
        workingParentID === accepted.parentID
      );
    })
  );
  const workingPublishedRoots = tree.collections.filter((collection) => {
    if (!collection.publishingEnabled) return false;

    let currentParent = collection.parentID
      ? treeCollectionsByID.get(collection.parentID)
      : undefined;

    while (currentParent) {
      if (currentParent.publishingEnabled) return false;

      currentParent = currentParent.parentID
        ? treeCollectionsByID.get(currentParent.parentID)
        : undefined;
    }

    return true;
  });
  for (const collection of workingPublishedRoots) {
    if (snapshotCollectionsByID.get(collection.id)?.publishedRoot) {
      comparableCollectionIDs.add(collection.id);
    }
  }

  // Publishing roots keep parent-local draft ranks, even though snapshots put them at the root.
  const reorderedCollectionIDs = getReorderedItemIDs(
    [...comparableCollectionIDs].map((id) => {
      const current = workingCollectionsByID.get(id)!;

      return { id, parentID: current.parentID, rank: current.rank };
    }),
    [...comparableCollectionIDs].map((id) => ({
      id,
      parentID: workingCollectionsByID.get(id)!.parentID,
      rank: snapshotCollectionsByID.get(id)!.rank
    }))
  );
  const changeSetCollections: PublishingChangeSetCollection[] = [];

  for (const id of new Set([...workingCollectionIDs, ...snapshotCollectionIDs])) {
    const working = workingCollectionsByID.get(id) || null;
    const accepted = snapshotCollectionsByID.get(id) || null;
    const workingInScope = Boolean(working && !working.deletedAt && workingCollectionIDs.has(id));
    const acceptedInScope = Boolean(accepted && snapshotCollectionIDs.has(id));
    const treeParentID =
      id === collectionID ? null : workingInScope ? working!.parentID : accepted!.parentID;
    const workingPublishedRoot = id === collectionID && currentPublishingRoot;
    const workingParentID = workingPublishedRoot ? null : working?.parentID || null;
    const structureChanged =
      workingParentID !== accepted?.parentID ||
      workingPublishedRoot !== accepted?.publishedRoot ||
      reorderedCollectionIDs.has(id);
    let status: PublishingChangeStatus;

    if (!acceptedInScope) {
      status = "pending-publish";
    } else if (!workingInScope) {
      status = "pending-removal";
    } else if (working?.name !== accepted?.name || structureChanged) {
      status = "changes";
    } else {
      status = "published";
    }

    changeSetCollections.push({
      accepted,
      acceptedInScope,
      id,
      status,
      structureChanged,
      treeParentID,
      working,
      workingInScope
    });
  }

  const scopedEntryRows = entryRows.filter((row) => {
    return Boolean(
      (row.collectionID && workingCollectionIDs.has(row.collectionID)) ||
      (row.acceptedCollectionID && snapshotCollectionIDs.has(row.acceptedCollectionID))
    );
  });
  const comparableEntryRows = entryRows.filter((row) => {
    return (
      Boolean(row.acceptedVersionID) &&
      !row.deletedAt &&
      Boolean(row.collectionID && workingCollectionIDs.has(row.collectionID)) &&
      Boolean(row.acceptedCollectionID && snapshotCollectionIDs.has(row.acceptedCollectionID)) &&
      row.collectionID === row.acceptedCollectionID &&
      isCollectionPublishingEnabled(tree, row.collectionID)
    );
  });
  const reorderedEntryIDs = getReorderedItemIDs(
    comparableEntryRows.map((row) => ({
      id: row.id,
      parentID: row.collectionID,
      rank: row.rank
    })),
    comparableEntryRows.map((row) => ({
      id: row.id,
      parentID: row.acceptedCollectionID,
      rank: row.acceptedRank!
    }))
  );
  const changeSetEntries: PublishingChangeSetEntry[] = [];

  for (const row of scopedEntryRows) {
    const acceptedInScope = Boolean(
      row.acceptedVersionID &&
      row.acceptedCollectionID &&
      snapshotCollectionIDs.has(row.acceptedCollectionID)
    );
    const workingInScope = Boolean(
      !row.deletedAt &&
      row.collectionID &&
      workingCollectionIDs.has(row.collectionID) &&
      isCollectionPublishingEnabled(tree, row.collectionID)
    );

    if (!acceptedInScope && !workingInScope) continue;

    const accepted = row.acceptedVersionID
      ? {
          collectionID: row.acceptedCollectionID,
          entryName: row.acceptedEntryName!,
          hash: row.acceptedHash!,
          publishedAt: row.acceptedPublishedAt!,
          rank: row.acceptedRank!,
          schemaRevisionID: row.acceptedSchemaRevisionID,
          versionID: row.acceptedVersionID!
        }
      : null;
    const working: PublishingWorkingEntry = {
      collectionID: row.collectionID,
      deletedAt: row.deletedAt,
      hash: workingContentHashes?.get(row.id) ?? row.hash,
      id: row.id,
      name: row.name,
      rank: row.rank,
      schemaRevisionID: row.schemaRevisionID
    };
    const documentChanged = Boolean(accepted && working.hash !== accepted.hash);
    const nameChanged = Boolean(accepted && working.name !== accepted.entryName);
    const schemaChanged = Boolean(
      accepted && working.schemaRevisionID !== accepted.schemaRevisionID
    );
    const contentChanged = documentChanged || nameChanged || schemaChanged;
    const structureChanged = Boolean(
      accepted && (working.collectionID !== accepted.collectionID || reorderedEntryIDs.has(row.id))
    );
    let status: PublishingChangeStatus;

    if (!acceptedInScope) {
      status = "pending-publish";
    } else if (!workingInScope) {
      status = "pending-removal";
    } else if (contentChanged || structureChanged) {
      status = "changes";
    } else {
      status = "published";
    }

    changeSetEntries.push({
      accepted,
      acceptedInScope,
      contentChanged,
      documentChanged,
      id: row.id,
      nameChanged,
      schemaChanged,
      status,
      structureChanged,
      working,
      workingInScope
    });
  }

  return {
    acceptedCollections: snapshotCollectionRows,
    channel,
    collectionID,
    collections: changeSetCollections,
    entries: changeSetEntries,
    snapshotID: snapshot.id,
    workingCollections
  };
};

export { loadPublishingChangeSet };
export type {
  LoadPublishingChangeSetInput,
  PublishingAcceptedCollection,
  PublishingAcceptedEntry,
  PublishingChangeSet,
  PublishingChangeSetCollection,
  PublishingChangeSetEntry,
  PublishingChangeStatus,
  PublishingWorkingCollection,
  PublishingWorkingEntry
} from "./change-set-types";
