import {
  collections,
  entries,
  entryVersions,
  publishingSnapshotCollections,
  publishingSnapshotEntries
} from "#backend/db";
import { normalizePublishingChannelCode, resolvePublishingSnapshot } from "#backend/lib/publishing";
import { withAuthorization } from "#backend/lib/policy";
import { toCollectionID, toEntryID, toSnapshotID, toVersionID } from "#backend/lib/primitives";
import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";

interface PublishingEntryOverlay {
  canReadVersions: boolean;
  canUnpublish: boolean;
  channel: string;
  collectionID: string | null;
  entryID: string;
  name: string;
  order: string;
  publishingCollectionID: string | null;
  publishingCollectionName: string | null;
  reason: PublishingEntryOverlayReason;
  snapshotCollectionID: string | null;
  snapshotID: string;
  versionID: string;
  workingCollectionID: string | null;
}
interface PublishingCollectionOverlay {
  canUnpublish: boolean;
  channel: string;
  collectionID: string;
  name: string;
  order: string;
  parentID: string | null;
  publishingCollectionID: string;
  publishingCollectionName: string;
  snapshotID: string;
}
interface PublishingExplorerOverlay {
  collections: PublishingCollectionOverlay[];
  entries: PublishingEntryOverlay[];
}
interface GetPublishingExplorerOverlayInput {
  channel: string;
}
type PublishingEntryOverlayReason = "deleted" | "moved";

const getExplorerOverlay = withAuthorization<
  GetPublishingExplorerOverlayInput,
  undefined,
  PublishingExplorerOverlay
>(
  {
    includeDeleted: true,
    permissions: { session: true },
    transaction: "atomic",
    tree: true
  },
  async ({ authorization, database, input, workspaceID }) => {
    const channel = normalizePublishingChannelCode(input.channel);
    const snapshot = await resolvePublishingSnapshot(database, workspaceID, {
      channelCode: channel
    });
    const [snapshotCollections, workingCollections, rows] = await Promise.all([
      database
        .select({
          collectionID: publishingSnapshotCollections.collectionID,
          name: publishingSnapshotCollections.name,
          parentID: publishingSnapshotCollections.parentID,
          publishedRoot: publishingSnapshotCollections.publishedRoot,
          rank: publishingSnapshotCollections.rank
        })
        .from(publishingSnapshotCollections)
        .where(eq(publishingSnapshotCollections.snapshotID, snapshot.id)),
      database
        .select({
          collectionID: collections.id,
          deletedAt: collections.deletedAt,
          parentID: collections.parentID
        })
        .from(collections)
        .where(eq(collections.workspaceID, workspaceID)),
      database
        .select({
          collectionDeletedAt: collections.deletedAt,
          collectionID: entries.collectionID,
          deletedAt: entries.deletedAt,
          entryID: entries.id,
          entryName: entries.name,
          name: entryVersions.entryName,
          rank: publishingSnapshotEntries.rank,
          snapshotCollectionID: publishingSnapshotEntries.collectionID,
          versionID: publishingSnapshotEntries.versionID
        })
        .from(publishingSnapshotEntries)
        .innerJoin(
          entries,
          and(
            eq(entries.workspaceID, workspaceID),
            eq(entries.id, publishingSnapshotEntries.entryID)
          )
        )
        .innerJoin(
          entryVersions,
          and(
            eq(entryVersions.workspaceID, workspaceID),
            eq(entryVersions.entryID, publishingSnapshotEntries.entryID),
            eq(entryVersions.id, publishingSnapshotEntries.versionID)
          )
        )
        .leftJoin(
          collections,
          and(
            eq(collections.workspaceID, workspaceID),
            eq(collections.id, publishingSnapshotEntries.collectionID)
          )
        )
        .where(
          and(
            eq(publishingSnapshotEntries.snapshotID, snapshot.id),
            or(
              isNotNull(entries.deletedAt),
              sql`${entries.collectionID} is distinct from ${publishingSnapshotEntries.collectionID}`
            )
          )
        )
        .orderBy(desc(publishingSnapshotEntries.rank), asc(publishingSnapshotEntries.entryID))
    ]);
    const snapshotCollectionsByID = new Map(
      snapshotCollections.map((collection) => [collection.collectionID, collection])
    );
    const workingCollectionsByID = new Map(
      workingCollections.map((collection) => [collection.collectionID, collection])
    );
    const findPublishingCollection = (collectionID: string | null) => {
      let publishingCollection = collectionID
        ? snapshotCollectionsByID.get(collectionID)
        : undefined;

      while (publishingCollection && !publishingCollection.publishedRoot) {
        publishingCollection = publishingCollection.parentID
          ? snapshotCollectionsByID.get(publishingCollection.parentID)
          : undefined;
      }

      return publishingCollection;
    };
    const collectionOverlays: PublishingCollectionOverlay[] = snapshotCollections.flatMap(
      (collection) => {
        const workingCollection = workingCollectionsByID.get(collection.collectionID);
        const workingParent = workingCollection?.parentID
          ? workingCollectionsByID.get(workingCollection.parentID)
          : undefined;

        if (workingCollection && !workingCollection.deletedAt) return [];
        if (!authorization.canEntry(collection.collectionID, "publishing:read")) return [];

        const publishingCollection = findPublishingCollection(collection.collectionID);
        const parentID = collection.publishedRoot
          ? workingParent && !workingParent.deletedAt && workingParent.parentID
            ? workingParent.collectionID
            : null
          : collection.parentID;

        if (!publishingCollection) return [];

        return [
          {
            canUnpublish: authorization.canCollection(
              collection.collectionID,
              "publishing:unpublish-tree"
            ),
            channel,
            collectionID: toCollectionID(collection.collectionID),
            name: collection.name,
            order: collection.rank,
            parentID: parentID ? toCollectionID(parentID) : null,
            publishingCollectionID: toCollectionID(publishingCollection.collectionID),
            publishingCollectionName: publishingCollection.name,
            snapshotID: toSnapshotID(snapshot.id)
          }
        ];
      }
    );

    const entryOverlays: PublishingEntryOverlay[] = rows.flatMap((row) => {
      if (!authorization.canEntry(row.collectionID, "publishing:read")) return [];

      const publishingCollection = findPublishingCollection(row.snapshotCollectionID);

      return [
        {
          canReadVersions: authorization.canEntry(row.collectionID, "version:read"),
          canUnpublish: authorization.canEntry(row.collectionID, "publishing:unpublish"),
          channel,
          collectionID:
            row.snapshotCollectionID && !row.collectionDeletedAt
              ? toCollectionID(row.snapshotCollectionID)
              : null,
          entryID: toEntryID(row.entryID),
          name: row.name || row.entryName,
          order: row.rank,
          publishingCollectionID: publishingCollection
            ? toCollectionID(publishingCollection.collectionID)
            : null,
          publishingCollectionName: publishingCollection?.name || null,
          reason: row.deletedAt ? "deleted" : "moved",
          snapshotCollectionID: row.snapshotCollectionID
            ? toCollectionID(row.snapshotCollectionID)
            : null,
          snapshotID: toSnapshotID(snapshot.id),
          versionID: toVersionID(row.versionID),
          workingCollectionID: row.collectionID ? toCollectionID(row.collectionID) : null
        }
      ];
    });

    return { collections: collectionOverlays, entries: entryOverlays };
  }
);

export { getExplorerOverlay };
export type { PublishingCollectionOverlay, PublishingEntryOverlay, PublishingExplorerOverlay };
