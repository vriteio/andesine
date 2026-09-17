import {
  contents,
  entries,
  publishingSnapshotCollections,
  publishingSnapshotEntries,
  entryVersions,
  publishingChannels
} from "#backend/db";
import { db } from "#backend/lib/adapters/postgres";
import { toCollectionID, toEntryID, toUUID, toVersionID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { normalizePublishingChannelCode } from "./channel";
import { isCollectionPublishingEnabled, loadPublishingTree } from "./tree";
import { getReorderedItemIDs } from "./snapshot-status";

interface PublishingCollectionStatus {
  collectionID: string;
  hasUnpublishedChanges: boolean;
  published: boolean;
}

interface PublishingEntryStatus {
  entryID: string;
  hasUnpublishedChanges: boolean;
  versionID: string | null;
}
interface PublishedEntryRoot {
  collectionID: string;
  entryID: string;
  name: string;
}
interface PublishedCollectionRoot {
  collectionID: string;
  publishingCollectionID: string;
}
interface PublishingStatusSnapshot {
  channel: string;
  collections: PublishingCollectionStatus[];
  enabledCollectionIDs: string[];
  entries: PublishingEntryStatus[];
  publishedCollectionRoots: PublishedCollectionRoot[];
  publishedEntryRoots: PublishedEntryRoot[];
}

const getPublishingStatusSnapshot = async (input: {
  workspaceID: string;
  channel: string;
  entryIDs?: string[];
}): Promise<PublishingStatusSnapshot> => {
  const workspaceID = toUUID(input.workspaceID);
  const channelCode = normalizePublishingChannelCode(input.channel);
  const entryIDs = input.entryIDs?.map(toUUID);

  return db.transaction(async (tx) => {
    const [channel] = await tx
      .select({ id: publishingChannels.id, snapshotID: publishingChannels.currentSnapshotID })
      .from(publishingChannels)
      .where(
        and(
          eq(publishingChannels.workspaceID, workspaceID),
          eq(publishingChannels.code, channelCode),
          isNull(publishingChannels.deletedAt)
        )
      );

    if (!channel) throw new ORPCError("NOT_FOUND", { message: "Publishing channel not found" });
    if (!channel.snapshotID) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Publishing channel has no current snapshot"
      });
    }

    const [tree, snapshotCollections] = await Promise.all([
      loadPublishingTree(tx, workspaceID),
      tx
        .select({
          collectionID: publishingSnapshotCollections.collectionID,
          name: publishingSnapshotCollections.name,
          parentID: publishingSnapshotCollections.parentID,
          publishedRoot: publishingSnapshotCollections.publishedRoot,
          rank: publishingSnapshotCollections.rank
        })
        .from(publishingSnapshotCollections)
        .where(eq(publishingSnapshotCollections.snapshotID, channel.snapshotID))
        .orderBy(asc(publishingSnapshotCollections.collectionID))
    ]);
    const enabledCollectionIDs = tree.collections
      .filter(({ publishingEnabled }) => publishingEnabled)
      .map(({ id }) => toCollectionID(id));
    const workingCollections = tree.collections.filter((collection) => {
      return isCollectionPublishingEnabled(tree, collection.id);
    });
    const workingCollectionsByID = new Map(
      workingCollections.map((collection) => [collection.id, collection])
    );
    const snapshotCollectionsByID = new Map(
      snapshotCollections.map((collection) => [collection.collectionID, collection])
    );
    const workingRootIDs = new Set(
      workingCollections
        .filter(({ parentID }) => {
          return !parentID || !isCollectionPublishingEnabled(tree, parentID);
        })
        .map(({ id }) => id)
    );
    const comparableCollectionIDs = new Set(
      workingCollections
        .filter((collection) => {
          const snapshotCollection = snapshotCollectionsByID.get(collection.id);
          const parentID = workingRootIDs.has(collection.id) ? null : collection.parentID;

          return Boolean(snapshotCollection && snapshotCollection.parentID === parentID);
        })
        .map(({ id }) => id)
    );
    // Compare snapshot order within each draft parent, including separate publishing roots.
    const reorderedCollectionIDs = getReorderedItemIDs(
      [...comparableCollectionIDs].map((id) => {
        const collection = workingCollectionsByID.get(id)!;

        return {
          id,
          parentID: collection.parentID,
          rank: collection.rank
        };
      }),
      [...comparableCollectionIDs].map((id) => {
        const collection = snapshotCollectionsByID.get(id)!;

        return {
          id,
          parentID: workingCollectionsByID.get(id)!.parentID,
          rank: collection.rank
        };
      })
    );
    const collectionStatuses: PublishingCollectionStatus[] = [];
    const publishedCollectionRoots = snapshotCollections.map((collection) => {
      let root = collection;

      while (root.parentID) {
        root = snapshotCollectionsByID.get(root.parentID)!;
      }

      return {
        collectionID: toCollectionID(collection.collectionID),
        publishingCollectionID: toCollectionID(root.collectionID)
      };
    });

    for (const collectionID of new Set([
      ...workingCollectionsByID.keys(),
      ...snapshotCollectionsByID.keys()
    ])) {
      const workingCollection = workingCollectionsByID.get(collectionID);
      const snapshotCollection = snapshotCollectionsByID.get(collectionID);
      const workingParentID = workingCollection
        ? workingRootIDs.has(collectionID)
          ? null
          : workingCollection.parentID
        : null;
      const hasUnpublishedChanges = Boolean(
        !workingCollection ||
        !snapshotCollection ||
        workingCollection.name !== snapshotCollection.name ||
        workingParentID !== snapshotCollection.parentID ||
        workingRootIDs.has(collectionID) !== snapshotCollection.publishedRoot ||
        reorderedCollectionIDs.has(collectionID)
      );

      collectionStatuses.push({
        collectionID: toCollectionID(collectionID),
        hasUnpublishedChanges,
        published: Boolean(snapshotCollection)
      });
    }

    if (entryIDs?.length === 0) {
      return {
        channel: channelCode,
        collections: collectionStatuses,
        enabledCollectionIDs,
        entries: [],
        publishedCollectionRoots,
        publishedEntryRoots: []
      };
    }

    const filters = [eq(entries.workspaceID, workspaceID)];

    if (entryIDs) filters.push(inArray(entries.id, entryIDs));

    const rows = await tx
      .select({
        entryID: entries.id,
        collectionID: entries.collectionID,
        deletedAt: entries.deletedAt,
        entryName: entries.name,
        entryRank: entries.rank,
        draftHash: contents.hash,
        draftSchemaRevisionID: contents.schemaRevisionID,
        snapshotCollectionID: publishingSnapshotEntries.collectionID,
        snapshotRank: publishingSnapshotEntries.rank,
        versionID: publishingSnapshotEntries.versionID,
        assignedEntryName: entryVersions.entryName,
        assignedHash: entryVersions.hash,
        assignedSchemaRevisionID: entryVersions.schemaRevisionID
      })
      .from(entries)
      .leftJoin(contents, eq(contents.entryID, entries.id))
      .leftJoin(
        publishingSnapshotEntries,
        and(
          eq(publishingSnapshotEntries.entryID, entries.id),
          eq(publishingSnapshotEntries.snapshotID, channel.snapshotID)
        )
      )
      .leftJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
      .where(
        and(
          ...filters,
          entryIDs
            ? undefined
            : sql`${entries.deletedAt} is null or ${publishingSnapshotEntries.entryID} is not null`
        )
      )
      .orderBy(asc(entries.id));
    const orderingRows = entryIDs
      ? await tx
          .select({
            entryID: entries.id,
            collectionID: entries.collectionID,
            deletedAt: entries.deletedAt,
            entryRank: entries.rank,
            snapshotCollectionID: publishingSnapshotEntries.collectionID,
            snapshotRank: publishingSnapshotEntries.rank
          })
          .from(entries)
          .innerJoin(
            publishingSnapshotEntries,
            and(
              eq(publishingSnapshotEntries.entryID, entries.id),
              eq(publishingSnapshotEntries.snapshotID, channel.snapshotID)
            )
          )
          .where(and(eq(entries.workspaceID, workspaceID), isNull(entries.deletedAt)))
      : rows;
    const comparableRows = orderingRows.filter((row) => {
      return (
        !row.deletedAt &&
        row.snapshotRank !== null &&
        row.collectionID === row.snapshotCollectionID &&
        isCollectionPublishingEnabled(tree, row.collectionID)
      );
    });
    const reorderedEntryIDs = getReorderedItemIDs(
      comparableRows.map((row) => ({
        id: row.entryID,
        parentID: row.collectionID,
        rank: row.entryRank
      })),
      comparableRows.map((row) => ({
        id: row.entryID,
        parentID: row.snapshotCollectionID,
        rank: row.snapshotRank!
      }))
    );
    const publishedEntryRoots = rows.flatMap((row) => {
      let collection = row.snapshotCollectionID
        ? snapshotCollectionsByID.get(row.snapshotCollectionID)
        : undefined;

      while (collection && !collection.publishedRoot) {
        collection = collection.parentID
          ? snapshotCollectionsByID.get(collection.parentID)
          : undefined;
      }

      return collection
        ? [
            {
              collectionID: toCollectionID(collection.collectionID),
              entryID: toEntryID(row.entryID),
              name: collection.name
            }
          ]
        : [];
    });

    return {
      channel: channelCode,
      collections: collectionStatuses,
      enabledCollectionIDs,
      publishedCollectionRoots,
      publishedEntryRoots,
      entries: rows.map((row) => {
        const publishingEnabled = isCollectionPublishingEnabled(tree, row.collectionID);
        const contentChanged =
          row.draftHash !== row.assignedHash ||
          row.entryName !== row.assignedEntryName ||
          row.draftSchemaRevisionID !== row.assignedSchemaRevisionID;
        const structureChanged =
          row.collectionID !== row.snapshotCollectionID || reorderedEntryIDs.has(row.entryID);

        return {
          entryID: toEntryID(row.entryID),
          versionID: row.versionID ? toVersionID(row.versionID) : null,
          hasUnpublishedChanges: row.versionID
            ? Boolean(row.deletedAt) || !publishingEnabled || contentChanged || structureChanged
            : !row.deletedAt && publishingEnabled
        };
      })
    };
  });
};

export { getPublishingStatusSnapshot };
export type {
  PublishingCollectionStatus,
  PublishingEntryStatus,
  PublishedEntryRoot,
  PublishedCollectionRoot,
  PublishingStatusSnapshot
};
