import {
  publishingChannels,
  publishingSnapshotCollections,
  publishingSnapshotEntries
} from "@andesine/backend/db/publishing";
import { entryVersions } from "@andesine/backend/db/versions";
import type { PublishedSearchDocumentSource } from "@andesine/backend/lib/search";
import {
  toCollectionID,
  toEntryID,
  toSnapshotID,
  toUUID,
  toVersionID
} from "@andesine/backend/lib/primitives";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../database";

interface PublishedCollectionEntriesInput {
  collectionID: string;
  workspaceID: string;
}
interface PublishedEntrySourcesInput {
  entryID: string;
  workspaceID: string;
}

const getSnapshotCollectionKey = (snapshotID: string, collectionID: string): string => {
  return `${snapshotID}:${collectionID}`;
};
const loadPublishedChannelHeadKey = async (workspaceID: string): Promise<string> => {
  const rows = await db
    .select({
      channelID: publishingChannels.id,
      snapshotID: publishingChannels.currentSnapshotID
    })
    .from(publishingChannels)
    .where(
      and(
        eq(publishingChannels.workspaceID, toUUID(workspaceID)),
        isNull(publishingChannels.deletedAt)
      )
    )
    .orderBy(publishingChannels.id);

  return rows.map((row) => `${row.channelID}:${row.snapshotID || ""}`).join("|");
};
const loadPublishedCollectionEntryIDs = async (
  input: PublishedCollectionEntriesInput
): Promise<string[]> => {
  const workspaceID = toUUID(input.workspaceID);
  const collectionID = toUUID(input.collectionID);
  const [collectionRows, entryRows] = await Promise.all([
    db
      .select({
        collectionID: publishingSnapshotCollections.collectionID,
        parentID: publishingSnapshotCollections.parentID,
        snapshotID: publishingSnapshotCollections.snapshotID
      })
      .from(publishingSnapshotCollections)
      .innerJoin(
        publishingChannels,
        and(
          eq(publishingChannels.workspaceID, workspaceID),
          eq(publishingChannels.currentSnapshotID, publishingSnapshotCollections.snapshotID),
          isNull(publishingChannels.deletedAt)
        )
      )
      .where(eq(publishingSnapshotCollections.workspaceID, workspaceID)),
    db
      .select({
        collectionID: publishingSnapshotEntries.collectionID,
        entryID: publishingSnapshotEntries.entryID,
        snapshotID: publishingSnapshotEntries.snapshotID
      })
      .from(publishingSnapshotEntries)
      .innerJoin(
        publishingChannels,
        and(
          eq(publishingChannels.workspaceID, workspaceID),
          eq(publishingChannels.currentSnapshotID, publishingSnapshotEntries.snapshotID),
          isNull(publishingChannels.deletedAt)
        )
      )
      .where(eq(publishingSnapshotEntries.workspaceID, workspaceID))
  ]);
  const subtreeCollectionKeys = new Set(
    collectionRows
      .filter((collection) => collection.collectionID === collectionID)
      .map((collection) => {
        return getSnapshotCollectionKey(collection.snapshotID, collection.collectionID);
      })
  );
  let changed = true;

  while (changed) {
    changed = false;

    for (const collection of collectionRows) {
      if (!collection.parentID) continue;

      const key = getSnapshotCollectionKey(collection.snapshotID, collection.collectionID);
      const parentKey = getSnapshotCollectionKey(collection.snapshotID, collection.parentID);

      if (!subtreeCollectionKeys.has(key) && subtreeCollectionKeys.has(parentKey)) {
        subtreeCollectionKeys.add(key);
        changed = true;
      }
    }
  }

  return [
    ...new Set(
      entryRows.flatMap((entry) => {
        if (!entry.collectionID) return [];

        const key = getSnapshotCollectionKey(entry.snapshotID, entry.collectionID);

        return subtreeCollectionKeys.has(key) ? [toEntryID(entry.entryID)] : [];
      })
    )
  ];
};
const loadPublishedEntrySources = async (
  input: PublishedEntrySourcesInput
): Promise<PublishedSearchDocumentSource[]> => {
  const workspaceID = toUUID(input.workspaceID);
  const publicationRows = await db
    .select({
      channelCode: publishingChannels.code,
      channelID: publishingChannels.id,
      collectionID: publishingSnapshotEntries.collectionID,
      document: entryVersions.document,
      entryID: publishingSnapshotEntries.entryID,
      entryName: entryVersions.entryName,
      publishedAt: publishingSnapshotEntries.publishedAt,
      snapshotID: publishingSnapshotEntries.snapshotID,
      versionID: publishingSnapshotEntries.versionID
    })
    .from(publishingSnapshotEntries)
    .innerJoin(
      publishingChannels,
      and(
        eq(publishingChannels.workspaceID, workspaceID),
        eq(publishingChannels.currentSnapshotID, publishingSnapshotEntries.snapshotID),
        isNull(publishingChannels.deletedAt)
      )
    )
    .innerJoin(
      entryVersions,
      and(
        eq(entryVersions.id, publishingSnapshotEntries.versionID),
        eq(entryVersions.entryID, publishingSnapshotEntries.entryID),
        eq(entryVersions.workspaceID, workspaceID)
      )
    )
    .where(
      and(
        eq(publishingSnapshotEntries.entryID, toUUID(input.entryID)),
        eq(publishingSnapshotEntries.workspaceID, workspaceID)
      )
    );
  const snapshotIDs = [...new Set(publicationRows.map((publication) => publication.snapshotID))];

  if (snapshotIDs.length === 0) return [];

  const collectionRows = await db
    .select({
      collectionID: publishingSnapshotCollections.collectionID,
      name: publishingSnapshotCollections.name,
      parentID: publishingSnapshotCollections.parentID,
      snapshotID: publishingSnapshotCollections.snapshotID
    })
    .from(publishingSnapshotCollections)
    .where(
      and(
        eq(publishingSnapshotCollections.workspaceID, workspaceID),
        inArray(publishingSnapshotCollections.snapshotID, snapshotIDs)
      )
    );
  const collectionsByKey = new Map(
    collectionRows.map((collection) => [
      getSnapshotCollectionKey(collection.snapshotID, collection.collectionID),
      collection
    ])
  );

  return publicationRows.flatMap((publication) => {
    if (!publication.collectionID) return [];

    const lineage: typeof collectionRows = [];
    const visited = new Set<string>();
    let collection = collectionsByKey.get(
      getSnapshotCollectionKey(publication.snapshotID, publication.collectionID)
    );

    while (collection) {
      const key = getSnapshotCollectionKey(collection.snapshotID, collection.collectionID);

      if (visited.has(key)) return [];

      visited.add(key);
      lineage.unshift(collection);
      collection = collection.parentID
        ? collectionsByKey.get(getSnapshotCollectionKey(collection.snapshotID, collection.parentID))
        : undefined;
    }

    if (lineage.length === 0) return [];

    return [
      {
        scope: "published" as const,
        workspaceID: input.workspaceID,
        entryID: toEntryID(publication.entryID),
        collectionID: toCollectionID(publication.collectionID),
        ancestorCollectionIDs: lineage.slice(0, -1).map((item) => {
          return toCollectionID(item.collectionID);
        }),
        restrictedBoundaryIDs: [],
        collectionPath: lineage.map((item) => item.name),
        title: publication.entryName,
        content: publication.document,
        updatedAt: publication.publishedAt,
        channelID: publication.channelID,
        channelCode: publication.channelCode,
        snapshotID: toSnapshotID(publication.snapshotID),
        versionID: toVersionID(publication.versionID)
      }
    ];
  });
};

export { loadPublishedChannelHeadKey, loadPublishedCollectionEntryIDs, loadPublishedEntrySources };
