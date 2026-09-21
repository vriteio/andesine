import { getUserAuthorization } from "#backend/lib/policy";
import { assertPublishingSnapshot } from "#backend/lib/publishing/precondition";
import { collections, publishingChannels } from "#backend/db";
import {
  assertEntrySnapshotsSynced,
  getDisabledEntryIDs,
  getSubtreeEntryIDs,
  isCollectionPublishingEnabled,
  loadAuthorizedSnapshotRemovalEntries,
  loadPublishingTree,
  PUBLISHED_CHANNEL_CODE,
  publishEntries,
  resolveCollectionSnapshotChanges,
  syncEntrySnapshots,
  type CommitPublishingSnapshotResult
} from "#backend/lib/publishing";
import { toCollectionID, toEntryID, toUUID } from "#backend/lib/primitives";
import type { VersionSummary } from "#backend/lib/data";
import type { PublishingEntryStatus } from "#backend/lib/publishing";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { filterAuthorizedEntryIDs, withAuthorization } from "#backend/lib/policy";
import { unpublishCollection } from "./unpublish";

interface SetCollectionPublishingResult {
  changed: boolean;
  collectionID: string;
  createdVersions: VersionSummary[];
  publishingEntries: PublishingEntryStatus[];
  publishedEntries: number;
  snapshots: Array<{ channel: string; snapshot: CommitPublishingSnapshotResult }>;
}
interface SetCollectionsPublishingInput {
  collectionIDs: string[];
  enabled: boolean;
  expectedSnapshots?: Record<string, string>;
  publish?: boolean;
  contributorIDs: string[];
}
interface CommitCollectionsPublishingInput extends SetCollectionsPublishingInput {
  snapshotEntryIDs: string[];
}

const getCollectionDepth = (
  collectionParents: Map<string, string | null>,
  collectionID: string
): number => {
  let depth = 0;
  let parentID = collectionParents.get(collectionID);

  while (parentID) {
    depth += 1;
    parentID = collectionParents.get(parentID);
  }

  return depth;
};
const prepareCollectionsPublishing = withAuthorization<
  SetCollectionsPublishingInput,
  undefined,
  string[]
>(
  {
    actions: ({ input }) => ({
      collections: input.collectionIDs.map((collectionID) => ({
        action: "collection:set-publishing",
        collectionID
      }))
    }),
    tree: true
  },
  async ({ authorization, database, input, workspaceID }) => {
    const collectionIDs = [...new Set(input.collectionIDs.map(toUUID))];

    if (!input.enabled || !input.publish) return [];

    const tree = await loadPublishingTree(database, workspaceID);
    const collectionsByID = new Map(
      tree.collections.map((collection) => [collection.id, collection])
    );
    const selectedCollections = collectionIDs.map((collectionID) => {
      return collectionsByID.get(collectionID);
    });

    if (selectedCollections.some((collection) => !collection || collection.parentID === null)) {
      throw new ORPCError("NOT_FOUND", { message: "Collection not found" });
    }

    const subtreeEntryIDs = await Promise.all(
      collectionIDs.map((collectionID) => {
        return getSubtreeEntryIDs(database, workspaceID, tree, collectionID);
      })
    );

    return filterAuthorizedEntryIDs({
      action: "publishing:publish",
      authorization,
      database,
      entryIDs: [...new Set(subtreeEntryIDs.flat())],
      workspaceID
    });
  }
);
const commitCollectionsPublishing = withAuthorization<
  CommitCollectionsPublishingInput,
  undefined,
  SetCollectionPublishingResult[]
>(
  {
    actions: ({ input }) => ({
      collections: input.collectionIDs.map((collectionID) => ({
        action: "collection:set-publishing",
        collectionID
      }))
    }),
    tree: true,
    includeDeleted: true,
    transaction: "locked-workspace"
  },
  async ({ auth, authorization, authorizationScope, database, input, workspaceID }) => {
    for (const [channel, snapshotID] of Object.entries(input.expectedSnapshots || {}).sort(
      ([a], [b]) => a.localeCompare(b)
    )) {
      await assertPublishingSnapshot(database, workspaceID, channel, snapshotID);
    }

    const collectionIDs = [...new Set(input.collectionIDs.map(toUUID))];

    const currentCollections = await database
      .select({
        id: collections.id,
        parentID: collections.parentID,
        publishingEnabled: collections.publishingEnabled
      })
      .from(collections)
      .where(
        and(
          inArray(collections.id, collectionIDs),
          eq(collections.workspaceID, workspaceID),
          isNull(collections.deletedAt)
        )
      )
      .for("update");

    if (currentCollections.length !== collectionIDs.length) {
      throw new ORPCError("NOT_FOUND", { message: "Collection not found" });
    }

    if (input.enabled && currentCollections.some((collection) => collection.parentID === null)) {
      throw new ORPCError("NOT_FOUND", { message: "Collection not found" });
    }

    const tree = await loadPublishingTree(database, workspaceID);
    const collectionsByID = new Map(
      currentCollections.map((collection) => [collection.id, collection])
    );
    const treeCollectionsByID = new Map(
      tree.collections.map((collection) => [collection.id, collection])
    );
    const collectionParents = new Map(
      tree.collections.map((collection) => [collection.id, collection.parentID])
    );
    const orderedCollectionIDs = input.enabled
      ? [...collectionIDs].sort((left, right) => {
          return (
            getCollectionDepth(collectionParents, left) -
            getCollectionDepth(collectionParents, right)
          );
        })
      : collectionIDs;
    const results: SetCollectionPublishingResult[] = [];
    const collectionsToPublish: string[] = [];
    const publishableEntryIDs = new Set<string>();
    const unpublishedEntryIDs = new Set<string>();
    let publicationResultIndex = -1;

    for (const collectionID of orderedCollectionIDs) {
      const collection = collectionsByID.get(collectionID)!;

      if (collection.publishingEnabled === input.enabled) {
        results.push({
          changed: false,
          collectionID,
          createdVersions: [],
          publishingEntries: [],
          publishedEntries: 0,
          snapshots: []
        });
        continue;
      }

      const wasEnabled = isCollectionPublishingEnabled(tree, collectionID);

      if (input.enabled && !wasEnabled && input.publish === undefined) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose whether to publish the latest entry versions",
          data: {
            hints: [
              "Set publish to false to enable publishing without publishing content, or true to publish the latest entry versions."
            ]
          }
        });
      }

      await database
        .update(collections)
        .set({ publishingEnabled: input.enabled, updatedAt: new Date() })
        .where(eq(collections.id, collectionID));

      const treeCollection = treeCollectionsByID.get(collectionID);

      if (treeCollection) treeCollection.publishingEnabled = input.enabled;

      if (input.enabled) {
        const entryIDs = await getSubtreeEntryIDs(database, workspaceID, tree, collectionID);

        if (wasEnabled || !input.publish) {
          results.push({
            changed: true,
            collectionID,
            createdVersions: [],
            publishingEntries: wasEnabled
              ? []
              : entryIDs.map((entryID) => ({
                  entryID: toEntryID(entryID),
                  hasUnpublishedChanges: true,
                  versionID: null
                })),
            publishedEntries: 0,
            snapshots: []
          });
          continue;
        }

        const collectionPublishableEntryIDs = await filterAuthorizedEntryIDs({
          action: "publishing:publish",
          authorization,
          database,
          entryIDs,
          workspaceID
        });

        const collectionPublishedEntryIDs = new Set(collectionPublishableEntryIDs);

        assertEntrySnapshotsSynced(collectionPublishableEntryIDs, input.snapshotEntryIDs);

        collectionsToPublish.push(collectionID);
        for (const entryID of collectionPublishableEntryIDs) publishableEntryIDs.add(entryID);
        for (const entryID of entryIDs) {
          if (!collectionPublishedEntryIDs.has(entryID)) unpublishedEntryIDs.add(entryID);
        }

        if (publicationResultIndex === -1) publicationResultIndex = results.length;

        results.push({
          changed: true,
          collectionID,
          createdVersions: [],
          publishingEntries: [],
          publishedEntries: 0,
          snapshots: []
        });
        continue;
      }

      const disabledEntryIDs = await getDisabledEntryIDs(database, workspaceID, tree, collectionID);

      if (disabledEntryIDs.length > 0) {
        for (const entryID of disabledEntryIDs) unpublishedEntryIDs.add(entryID);
      }

      results.push({
        changed: true,
        collectionID,
        createdVersions: [],
        publishingEntries: disabledEntryIDs.map((entryID) => ({
          entryID: toEntryID(entryID),
          hasUnpublishedChanges: false,
          versionID: null
        })),
        publishedEntries: 0,
        snapshots: []
      });
    }

    if (collectionsToPublish.length > 0) {
      const snapshotOperations = await resolveCollectionSnapshotChanges(database, {
        authorization,
        workspaceID,
        channelCode: PUBLISHED_CHANNEL_CODE,
        collectionIDs: collectionsToPublish
      });

      await loadAuthorizedSnapshotRemovalEntries({
        ...snapshotOperations,
        authorization,
        database,
        workspaceID
      });

      const result = await publishEntries(database, {
        authorization,
        workspaceID,
        entries: [...publishableEntryIDs].map((entryID) => ({ entryID })),
        channel: PUBLISHED_CHANNEL_CODE,
        contributorIDs: input.contributorIDs,
        creatorID: getUserAuthorization(auth)?.userID,
        snapshotOperations,
        subscriptionPlan: auth.subscriptionPlan
      });
      const publicationResult = results[publicationResultIndex];

      publicationResult.createdVersions = result.createdVersions;
      publicationResult.publishedEntries = result.publishedEntries;
      publicationResult.publishingEntries = [
        ...result.publishingEntries,
        ...[...unpublishedEntryIDs]
          .filter((entryID) => !publishableEntryIDs.has(entryID))
          .map((entryID) => ({
            entryID: toEntryID(entryID),
            hasUnpublishedChanges: true,
            versionID: null
          }))
      ];
      if (result.snapshot) {
        publicationResult.snapshots.push({
          channel: PUBLISHED_CHANNEL_CODE,
          snapshot: result.snapshot
        });
      }
    }

    if (!input.enabled) {
      const channels = await database
        .select({ code: publishingChannels.code })
        .from(publishingChannels)
        .where(
          and(eq(publishingChannels.workspaceID, workspaceID), isNull(publishingChannels.deletedAt))
        )
        .orderBy(publishingChannels.id);

      for (const channel of channels) {
        const result = await unpublishCollection({
          auth,
          channel: channel.code,
          collectionIDs: collectionIDs.map(toCollectionID),
          includeWorkingTree: true,
          skipAuthorization: authorizationScope
        });

        results[0].snapshots.push({ channel: channel.code, snapshot: result.snapshot });
        if (channel.code === PUBLISHED_CHANNEL_CODE) {
          results[0].publishingEntries.push(...result.publishingEntries);
        }
      }
    }

    return results.map((result) => ({
      ...result,
      collectionID: toCollectionID(result.collectionID)
    }));
  }
);
const setCollectionsPublishing = async (
  input: Parameters<typeof prepareCollectionsPublishing>[0]
): Promise<SetCollectionPublishingResult[]> => {
  const snapshotEntryIDs = await prepareCollectionsPublishing(input);

  await syncEntrySnapshots(input.auth.workspaceID, snapshotEntryIDs);

  return commitCollectionsPublishing({
    collectionIDs: input.collectionIDs,
    enabled: input.enabled,
    expectedSnapshots: input.expectedSnapshots,
    publish: input.publish,
    contributorIDs: input.contributorIDs,
    snapshotEntryIDs,
    auth: input.auth
  });
};

export { setCollectionsPublishing };
