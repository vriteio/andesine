import { collections } from "#backend/db";
import {
  assertEntrySnapshotsSynced,
  getSubtreeEntryIDs,
  isCollectionPublishingEnabled,
  loadPublishingTree,
  publishEntries,
  type PublishingEntryStatus,
  syncEntrySnapshots
} from "#backend/lib/publishing";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import type { VersionSummary } from "#backend/lib/data";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { filterAuthorizedEntryIDs, withAuthorization } from "#backend/lib/policy";

interface PublishCollectionInput {
  collectionIDs: string[];
  channel: string;
  contributorIDs: string[];
}
interface PublishCollectionResult {
  createdVersions: VersionSummary[];
  publishingEntries: PublishingEntryStatus[];
  publishedEntries: number;
}
interface CommitPublishCollectionInput extends PublishCollectionInput {
  snapshotEntryIDs: string[];
}

const preparePublishCollection = withAuthorization<PublishCollectionInput, undefined, string[]>(
  {
    actions: ({ input }) => ({
      collections: input.collectionIDs.map((collectionID) => ({
        action: "publishing:publish-tree",
        collectionID
      }))
    }),
    tree: true
  },
  async ({ authorization, database, input, workspaceID }) => {
    const collectionIDs = [...new Set(input.collectionIDs.map(toUUID))];
    const currentCollections = await database
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          inArray(collections.id, collectionIDs),
          eq(collections.workspaceID, workspaceID),
          isNull(collections.deletedAt)
        )
      );

    if (currentCollections.length !== collectionIDs.length) {
      throw new ORPCError("NOT_FOUND", { message: "Collection not found" });
    }

    const tree = await loadPublishingTree(database, workspaceID);

    if (collectionIDs.some((id) => !isCollectionPublishingEnabled(tree, id))) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Publishing is not enabled for this collection"
      });
    }

    const subtreeEntryIDs = [
      ...new Set(
        (
          await Promise.all(
            collectionIDs.map((id) => getSubtreeEntryIDs(database, workspaceID, tree, id))
          )
        ).flat()
      )
    ];
    return filterAuthorizedEntryIDs({
      action: "publishing:publish",
      authorization,
      database,
      entryIDs: subtreeEntryIDs,
      workspaceID
    });
  }
);
const commitPublishCollection = withAuthorization<
  CommitPublishCollectionInput,
  undefined,
  PublishCollectionResult
>(
  {
    actions: ({ input }) => ({
      collections: input.collectionIDs.map((collectionID) => ({
        action: "publishing:publish-tree",
        collectionID
      }))
    }),
    transaction: "locked-workspace"
  },
  async ({ auth, authorizationScope, database, input, workspaceID }) => {
    const entryIDs = await preparePublishCollection({
      ...input,
      auth,
      skipAuthorization: authorizationScope
    });

    assertEntrySnapshotsSynced(entryIDs, input.snapshotEntryIDs);

    return publishEntries(database, {
      workspaceID,
      entries: entryIDs.map((entryID) => ({ entryID })),
      channel: input.channel,
      contributorIDs: input.contributorIDs
    });
  }
);
const publishCollection = async (
  input: Parameters<typeof preparePublishCollection>[0]
): Promise<PublishCollectionResult> => {
  const snapshotEntryIDs = await preparePublishCollection(input);

  await syncEntrySnapshots(input.auth.workspaceID, snapshotEntryIDs);

  return commitPublishCollection({
    collectionIDs: input.collectionIDs,
    channel: input.channel,
    contributorIDs: input.contributorIDs,
    snapshotEntryIDs,
    auth: input.auth
  });
};

export { publishCollection };
