import { createContentPaths, type CollectionSelector } from "#backend/lib/content/paths";
import {
  publishingSnapshotCollections,
  publishingSnapshotEntries,
  entryVersions
} from "#backend/db";
import { withPublicWorkspace } from "#backend/lib/policy";
import {
  normalizePublishingChannelCode,
  PUBLISHED_CHANNEL_CODE,
  resolvePublishingSnapshot
} from "#backend/lib/publishing";
import { toCollectionID, toEntryID, toSnapshotID, toVersionID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { asc, eq } from "drizzle-orm";

interface PublishedTreeEntry {
  path: string;
  id: string;
  name: string;
  version: {
    id: string;
    hash: string;
  };
}
interface PublishedTreeCollection {
  path: string;
  id: string | null;
  name: string;
  entries: PublishedTreeEntry[];
  collections: PublishedTreeCollection[];
}
interface PublishedContentTree {
  channel: string;
  collection: PublishedTreeCollection;
  expiresAt: Date | null;
  snapshotID: string;
}

interface GetPublishedContentTreeInput extends CollectionSelector {
  channel?: string;
  snapshotID?: string;
}

const getPublishedContentTree = withPublicWorkspace<
  GetPublishedContentTreeInput,
  PublishedContentTree
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const snapshot = input.snapshotID
    ? await resolvePublishingSnapshot(database, workspaceID, { snapshotID: input.snapshotID })
    : await resolvePublishingSnapshot(database, workspaceID, {
        channelCode: normalizePublishingChannelCode(input.channel || PUBLISHED_CHANNEL_CODE)
      });
  const collectionRows = await database
    .select({
      id: publishingSnapshotCollections.collectionID,
      name: publishingSnapshotCollections.name,
      parentID: publishingSnapshotCollections.parentID
    })
    .from(publishingSnapshotCollections)
    .where(eq(publishingSnapshotCollections.snapshotID, snapshot.id))
    .orderBy(
      asc(publishingSnapshotCollections.rank),
      asc(publishingSnapshotCollections.collectionID)
    );
  const paths = createContentPaths(collectionRows);
  const collectionID = paths.resolveCollection(input) ?? null;
  const entryRows = await database
    .select({
      id: publishingSnapshotEntries.entryID,
      collectionID: publishingSnapshotEntries.collectionID,
      entryName: entryVersions.entryName,
      versionID: entryVersions.id,
      versionHash: entryVersions.hash
    })
    .from(publishingSnapshotEntries)
    .innerJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
    .where(eq(publishingSnapshotEntries.snapshotID, snapshot.id))
    .orderBy(asc(publishingSnapshotEntries.rank), asc(publishingSnapshotEntries.entryID));
  const entriesByCollection = new Map<string | null, PublishedTreeEntry[]>();
  const collectionsByParent = new Map<string | null, typeof collectionRows>();

  for (const row of entryRows) {
    const collectionEntries = entriesByCollection.get(row.collectionID) || [];

    collectionEntries.push({
      id: toEntryID(row.id),
      name: row.entryName,
      path: paths.entryPath(row.collectionID, row.entryName),
      version: {
        id: toVersionID(row.versionID),
        hash: row.versionHash
      }
    });
    entriesByCollection.set(row.collectionID, collectionEntries);
  }

  for (const row of collectionRows) {
    const childCollections = collectionsByParent.get(row.parentID) || [];

    childCollections.push(row);
    collectionsByParent.set(row.parentID, childCollections);
  }

  const mapCollection = (row: (typeof collectionRows)[number]): PublishedTreeCollection => {
    return {
      id: toCollectionID(row.id),
      name: row.name,
      path: paths.collectionPath(row.id),
      entries: entriesByCollection.get(row.id) || [],
      collections: (collectionsByParent.get(row.id) || []).map(mapCollection)
    };
  };
  const root = collectionRows.find(({ id }) => id === collectionID);

  if (collectionID && !root) {
    throw new ORPCError("NOT_FOUND", { message: "Published collection not found" });
  }

  return {
    channel: snapshot.channelCode,
    collection: root
      ? mapCollection(root)
      : {
          id: null,
          name: "",
          path: "/",
          entries: entriesByCollection.get(null) || [],
          collections: (collectionsByParent.get(null) || []).map(mapCollection)
        },
    expiresAt: snapshot.expiresAt,
    snapshotID: toSnapshotID(snapshot.id)
  };
});

export { getPublishedContentTree };
export type { PublishedContentTree, PublishedTreeCollection, PublishedTreeEntry };
