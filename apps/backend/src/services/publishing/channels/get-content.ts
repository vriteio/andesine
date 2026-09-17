import {
  canApplyPublishingRevertPlan,
  createPublishingRevertPlan,
  loadPublishingChangeSet,
  type PublishingChangeSet,
  type PublishingChangeStatus,
  type PublishingRevertSelection
} from "#backend/lib/publishing";
import { type AuthorizedCollectionTree, withAuthorization } from "#backend/lib/policy";
import { toCollectionID, toEntryID, toSnapshotID, toVersionID } from "#backend/lib/primitives";

interface ChannelContentEntry {
  canPublish: boolean;
  canRevert: boolean;
  canUnpublish: boolean;
  collectionID: string | null;
  deleted: boolean;
  entryID: string;
  name: string;
  publishedAt: string | null;
  rank: string;
  status: ChannelContentStatus;
  treeCollectionID: string | null;
  versionID: string | null;
}
interface ChannelContentCollection {
  canPublish: boolean;
  canRevert: boolean;
  canUnpublish: boolean;
  collectionID: string;
  deleted: boolean;
  name: string;
  parentID: string | null;
  rank: string;
  status: ChannelContentStatus;
}
interface GetChannelContentInput {
  channel: string;
  collectionID: string;
}
interface GetChannelContentResult {
  channel: string;
  collections: ChannelContentCollection[];
  entries: ChannelContentEntry[];
  snapshotID: string;
}

type ChannelContentStatus = PublishingChangeStatus;

const canRevertSelection = (
  authorization: AuthorizedCollectionTree,
  changeSet: PublishingChangeSet,
  selection: PublishingRevertSelection
): boolean => {
  try {
    const plan = createPublishingRevertPlan(changeSet, selection, authorization);

    return canApplyPublishingRevertPlan(authorization, plan);
  } catch {
    return false;
  }
};

const getChannelContent = withAuthorization<
  GetChannelContentInput,
  undefined,
  GetChannelContentResult
>(
  {
    includeDeleted: true,
    permissions: { session: true, key: ["read:publishing"] },
    transaction: "atomic",
    tree: true
  },
  async ({ authorization, database, input, workspaceID }) => {
    const changeSet = await loadPublishingChangeSet(database, workspaceID, input);
    const channelCollections: ChannelContentCollection[] = [];
    const channelEntries: ChannelContentEntry[] = [];

    for (const collection of changeSet.collections) {
      const { accepted, id, working } = collection;

      if (!authorization.canEntry(id, "publishing:read")) continue;

      channelCollections.push({
        canPublish:
          collection.workingInScope && authorization.canCollection(id, "publishing:publish-tree"),
        canRevert:
          collection.status !== "published" &&
          canRevertSelection(authorization, changeSet, { collectionIDs: [id] }),
        canUnpublish:
          collection.acceptedInScope &&
          authorization.canCollection(id, "publishing:unpublish-tree"),
        collectionID: toCollectionID(id),
        deleted: Boolean(working?.deletedAt),
        name: collection.workingInScope ? working!.name : accepted!.name,
        parentID: collection.treeParentID ? toCollectionID(collection.treeParentID) : null,
        rank: collection.workingInScope ? working!.rank : accepted!.rank,
        status: collection.status
      });
    }

    for (const entry of changeSet.entries) {
      const { accepted, working } = entry;

      if (!authorization.canEntry(working.collectionID, "publishing:read")) continue;

      channelEntries.push({
        canPublish:
          entry.workingInScope &&
          authorization.canEntry(working.collectionID, "publishing:publish"),
        canRevert:
          entry.status !== "published" &&
          canRevertSelection(authorization, changeSet, { entryIDs: [entry.id] }),
        canUnpublish:
          entry.acceptedInScope &&
          authorization.canEntry(working.collectionID, "publishing:unpublish"),
        collectionID: working.collectionID ? toCollectionID(working.collectionID) : null,
        deleted: Boolean(working.deletedAt),
        entryID: toEntryID(entry.id),
        name:
          entry.acceptedInScope && !entry.workingInScope
            ? accepted!.entryName || working.name
            : working.name,
        publishedAt: accepted?.publishedAt.toISOString() || null,
        rank: entry.workingInScope ? working.rank : accepted!.rank,
        status: entry.status,
        treeCollectionID: entry.workingInScope
          ? working.collectionID
            ? toCollectionID(working.collectionID)
            : null
          : accepted?.collectionID
            ? toCollectionID(accepted.collectionID)
            : null,
        versionID: accepted?.versionID ? toVersionID(accepted.versionID) : null
      });
    }

    return {
      channel: changeSet.channel,
      collections: channelCollections,
      entries: channelEntries,
      snapshotID: toSnapshotID(changeSet.snapshotID)
    };
  }
);

export { getChannelContent };
export type {
  ChannelContentCollection,
  ChannelContentEntry,
  ChannelContentStatus,
  GetChannelContentResult
};
