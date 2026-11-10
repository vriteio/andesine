import { publishingSnapshotEntries } from "@andesine/server/database";
import {
  getUserAuthorization,
  type EntryAuthorizationSource,
  loadEntryAuthorizationSources,
  withAuthorization
} from "#backend/lib/policy";
import { assertPublishingSnapshot } from "#backend/lib/publishing/precondition";
import {
  commitPublishingSnapshot,
  resolvePublishingSnapshot,
  type CommitPublishingSnapshotResult,
  type PublishingEntryStatus
} from "#backend/lib/publishing";
import { toEntryID, toUUID } from "@andesine/contracts/primitives";
import { and, eq, inArray } from "drizzle-orm";

interface UnpublishEntryInput {
  entryIDs: string[];
  channel: string;
  expectedSnapshotID?: string;
  versionID?: string;
}
interface UnpublishEntryResult {
  publishingEntries: PublishingEntryStatus[];
  removed: boolean;
  snapshot: CommitPublishingSnapshotResult;
}

const unpublishEntry = withAuthorization<
  UnpublishEntryInput,
  EntryAuthorizationSource[],
  UnpublishEntryResult
>(
  {
    actions: ({ resolved }) => ({
      entries: resolved.map(({ collectionID }) => ({
        action: "publishing:unpublish",
        collectionID
      }))
    }),
    includeDeleted: true,
    resolve: ({ database, input, workspaceID }) => {
      return loadEntryAuthorizationSources({
        database,
        entryIDs: input.entryIDs,
        includeDeleted: true,
        workspaceID
      });
    },
    tree: true,
    transaction: "locked-workspace"
  },
  async ({ auth, authorization, database, input, resolved, workspaceID }) => {
    await assertPublishingSnapshot(database, workspaceID, input.channel, input.expectedSnapshotID);

    const entryIDs = [...new Set(input.entryIDs.map(toUUID))];
    const versionID = input.versionID ? toUUID(input.versionID) : null;
    const snapshot = await resolvePublishingSnapshot(database, workspaceID, {
      channelCode: input.channel
    });
    const publishedEntries = await database
      .select({
        entryID: publishingSnapshotEntries.entryID,
        versionID: publishingSnapshotEntries.versionID
      })
      .from(publishingSnapshotEntries)
      .where(
        and(
          eq(publishingSnapshotEntries.snapshotID, snapshot.id),
          inArray(publishingSnapshotEntries.entryID, entryIDs)
        )
      );
    const entryRemovals = publishedEntries
      .filter((entry) => !versionID || entry.versionID === versionID)
      .map(({ entryID }) => entryID);
    const result = await commitPublishingSnapshot(database, {
      authorization,
      workspaceID,
      channelCode: input.channel,
      creatorID: getUserAuthorization(auth)?.userID,
      entryRemovals,
      expectedSnapshotID: snapshot.id,
      reason: "unpublish",
      subscriptionPlan: auth.subscriptionPlan
    });

    return {
      publishingEntries: resolved.map((entry) => ({
        entryID: toEntryID(entry.id),
        hasUnpublishedChanges:
          !entry.deletedAt && authorization.isPublishingEnabled(entry.collectionID),
        versionID: null
      })),
      removed: result.affectedEntryIDs.length > 0,
      snapshot: result
    };
  }
);

export { unpublishEntry };
