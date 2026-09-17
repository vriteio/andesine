import {
  getPublishingStatusSnapshot,
  type PublishedEntryRoot,
  type PublishedCollectionRoot
} from "#backend/lib/publishing";
import { entries } from "#backend/db";
import { withAuthorization } from "#backend/lib/policy";
import { toEntryID, toUUID } from "#backend/lib/primitives";
import { and, eq, inArray } from "drizzle-orm";

interface GetPublishingStatusInput {
  channel: string;
}

const getPublishingStatus = withAuthorization<
  GetPublishingStatusInput,
  undefined,
  {
    channel: string;
    neverPublishedCollectionIDs: string[];
    neverPublishedEntryIDs: string[];
    publishedEntryRoots: PublishedEntryRoot[];
    publishedCollectionRoots: PublishedCollectionRoot[];
    unpublishedCollectionIDs: string[];
    unpublishedEntryIDs: string[];
  }
>({ includeDeleted: true, tree: true }, async ({ authorization, database, input, workspaceID }) => {
  const snapshot = await getPublishingStatusSnapshot({
    workspaceID,
    channel: input.channel
  });
  const unpublishedEntryIDs = snapshot.entries
    .filter(({ hasUnpublishedChanges }) => hasUnpublishedChanges)
    .map(({ entryID }) => entryID);
  const neverPublishedEntryIDs = new Set(
    snapshot.entries
      .filter(({ hasUnpublishedChanges, versionID }) => hasUnpublishedChanges && !versionID)
      .map(({ entryID }) => entryID)
  );
  const statusEntryIDs = [
    ...new Set([
      ...unpublishedEntryIDs,
      ...snapshot.publishedEntryRoots.map(({ entryID }) => entryID)
    ])
  ];
  const rows = statusEntryIDs.length
    ? await database
        .select({ collectionID: entries.collectionID, id: entries.id })
        .from(entries)
        .where(
          and(eq(entries.workspaceID, workspaceID), inArray(entries.id, statusEntryIDs.map(toUUID)))
        )
    : [];
  const readableEntryIDs = new Set(
    rows
      .filter(({ collectionID }) => authorization.canEntry(collectionID, "publishing:read"))
      .map(({ id }) => toEntryID(id))
  );

  return {
    channel: snapshot.channel,
    neverPublishedCollectionIDs: snapshot.collections
      .filter(({ collectionID, hasUnpublishedChanges, published }) => {
        return (
          hasUnpublishedChanges && !published && authorization.canAccessCollection(collectionID)
        );
      })
      .map(({ collectionID }) => collectionID),
    neverPublishedEntryIDs: rows
      .filter(({ collectionID, id }) => {
        return (
          neverPublishedEntryIDs.has(toEntryID(id)) &&
          authorization.canEntry(collectionID, "publishing:read")
        );
      })
      .map(({ id }) => toEntryID(id)),
    publishedEntryRoots: snapshot.publishedEntryRoots.filter(({ entryID }) => {
      return readableEntryIDs.has(entryID);
    }),
    publishedCollectionRoots: snapshot.publishedCollectionRoots.filter(({ collectionID }) => {
      return authorization.canAccessCollection(collectionID);
    }),
    unpublishedCollectionIDs: snapshot.collections
      .filter(({ collectionID, hasUnpublishedChanges }) => {
        return hasUnpublishedChanges && authorization.canAccessCollection(collectionID);
      })
      .map(({ collectionID }) => collectionID),
    unpublishedEntryIDs: unpublishedEntryIDs.filter((entryID) => readableEntryIDs.has(entryID))
  };
});

export { getPublishingStatus };
