import { getUserAuthorization } from "#backend/lib/policy";
import { assertPublishingSnapshot } from "#backend/lib/publishing/precondition";
import { collections } from "#backend/db";
import {
  commitPublishingSnapshot,
  isCollectionPublishingEnabled,
  loadAuthorizedSnapshotRemovalEntries,
  loadPublishingTree,
  resolveCollectionSnapshotRemovals,
  type CommitPublishingSnapshotResult
} from "#backend/lib/publishing";
import type { PublishingEntryStatus } from "#backend/lib/publishing";
import { toEntryID, toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { withAuthorization } from "#backend/lib/policy";

interface UnpublishCollectionInput {
  collectionIDs: string[];
  channel: string;
  expectedSnapshotID?: string;
  includeWorkingTree?: boolean;
}
interface UnpublishCollectionResult {
  publishingEntries: PublishingEntryStatus[];
  snapshot: CommitPublishingSnapshotResult;
  unpublishedEntries: number;
}

const unpublishCollection = withAuthorization<
  UnpublishCollectionInput,
  undefined,
  UnpublishCollectionResult
>(
  {
    actions: ({ input }) => ({
      collections: input.collectionIDs.map((collectionID) => ({
        action: "publishing:unpublish-tree",
        collectionID
      }))
    }),
    includeDeleted: true,
    tree: true,
    transaction: "locked-workspace"
  },
  async ({ auth, authorization, database, input, workspaceID }) => {
    await assertPublishingSnapshot(database, workspaceID, input.channel, input.expectedSnapshotID);

    const collectionIDs = [...new Set(input.collectionIDs.map(toUUID))];

    const currentCollections = await database
      .select({ id: collections.id })
      .from(collections)
      .where(and(inArray(collections.id, collectionIDs), eq(collections.workspaceID, workspaceID)));

    if (currentCollections.length !== collectionIDs.length) {
      throw new ORPCError("NOT_FOUND", { message: "Collection not found" });
    }

    const tree = await loadPublishingTree(database, workspaceID);
    const snapshotOperations = await resolveCollectionSnapshotRemovals(database, {
      workspaceID,
      channelCode: input.channel,
      collectionIDs,
      includeWorkingTree: input.includeWorkingTree
    });
    const entryRows = await loadAuthorizedSnapshotRemovalEntries({
      ...snapshotOperations,
      authorization,
      database,
      workspaceID
    });
    const entryRowsByID = new Map(entryRows.map((entry) => [toEntryID(entry.id), entry]));
    const result = await commitPublishingSnapshot(database, {
      authorization,
      workspaceID,
      channelCode: input.channel,
      collectionRemovals: snapshotOperations.collectionRemovals,
      creatorID: getUserAuthorization(auth)?.userID,
      entryRemovals: snapshotOperations.entryRemovals,
      expectedSnapshotID: snapshotOperations.snapshotID,
      reason: "unpublish",
      subscriptionPlan: auth.subscriptionPlan
    });

    return {
      publishingEntries: result.affectedEntryIDs.map((entryID) => {
        const entry = entryRowsByID.get(entryID);

        return {
          entryID,
          hasUnpublishedChanges: Boolean(
            entry &&
            !entry.deletedAt &&
            isCollectionPublishingEnabled(tree, entry.collectionID || null)
          ),
          versionID: null
        };
      }),
      snapshot: result,
      unpublishedEntries: result.affectedEntryIDs.length
    };
  }
);

export { unpublishCollection };
