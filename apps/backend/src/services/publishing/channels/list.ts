import { entries, publishingChannels, publishingSnapshotEntries } from "#backend/db";
import { mapPublishingChannel, type PublishingChannel } from "#backend/lib/data";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { and, asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";

interface PublishingChannelListItem extends PublishingChannel {
  assignmentCount?: number;
}

interface ListChannelsInput {
  includeAssignmentCount?: boolean;
}

const listChannels = withAuthorization<ListChannelsInput, undefined, PublishingChannelListItem[]>(
  {
    includeDeleted: true,
    permissions: { session: true, key: ["read:publishing"] },
    tree: true
  },
  async ({ authorization, database, input, workspaceID }) => {
    const includeAssignmentCount = input.includeAssignmentCount;

    if (includeAssignmentCount) {
      const visibleCollectionIDs = authorization.collections.map(({ id }) => toUUID(id));
      const visibleEntry =
        visibleCollectionIDs.length > 0
          ? or(isNull(entries.collectionID), inArray(entries.collectionID, visibleCollectionIDs))!
          : isNull(entries.collectionID);
      const channels = await database
        .select({
          assignmentCount: count(entries.id),
          channel: publishingChannels
        })
        .from(publishingChannels)
        .leftJoin(
          publishingSnapshotEntries,
          and(
            eq(publishingSnapshotEntries.snapshotID, publishingChannels.currentSnapshotID),
            eq(publishingSnapshotEntries.workspaceID, workspaceID)
          )
        )
        .leftJoin(
          entries,
          and(
            eq(entries.id, publishingSnapshotEntries.entryID),
            eq(entries.workspaceID, workspaceID),
            visibleEntry
          )
        )
        .where(
          and(eq(publishingChannels.workspaceID, workspaceID), isNull(publishingChannels.deletedAt))
        )
        .groupBy(publishingChannels.id)
        .orderBy(desc(publishingChannels.builtIn), asc(publishingChannels.name));

      return channels.map(({ assignmentCount, channel }) => ({
        ...mapPublishingChannel(channel),
        assignmentCount: Number(assignmentCount)
      }));
    }

    const channels = await database
      .select()
      .from(publishingChannels)
      .where(
        and(eq(publishingChannels.workspaceID, workspaceID), isNull(publishingChannels.deletedAt))
      )
      .orderBy(desc(publishingChannels.builtIn), asc(publishingChannels.name));

    return channels.map(mapPublishingChannel);
  }
);

export { listChannels };
export type { PublishingChannelListItem };
