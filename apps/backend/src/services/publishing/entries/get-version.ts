import {
  entries,
  publishingSnapshotEntries,
  entryVersionContributors,
  entryVersions
} from "#backend/db";
import { mapVersion, type VersionDetails } from "#backend/lib/data";
import {
  normalizePublishingChannelCode,
  PUBLISHED_CHANNEL_CODE,
  resolvePublishingSnapshot,
  type ResolvedPublishingSnapshot
} from "#backend/lib/publishing";
import { type Database, withAuthorization } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

interface PublishedEntryVersionInput {
  entryID: string;
  channel?: string;
  snapshotID?: string;
}
interface PublishedEntryVersionSource {
  collectionID: string | null;
  snapshot: ResolvedPublishingSnapshot;
  version: VersionDetails;
}

const loadPublishedEntryVersion = async (
  database: Database,
  workspaceID: string,
  input: PublishedEntryVersionInput
): Promise<PublishedEntryVersionSource> => {
  const entryID = toUUID(input.entryID);
  const snapshot = input.snapshotID
    ? await resolvePublishingSnapshot(database, workspaceID, { snapshotID: input.snapshotID })
    : await resolvePublishingSnapshot(database, workspaceID, {
        channelCode: normalizePublishingChannelCode(input.channel || PUBLISHED_CHANNEL_CODE)
      });
  const [row] = await database
    .select({ collectionID: publishingSnapshotEntries.collectionID, version: entryVersions })
    .from(publishingSnapshotEntries)
    .innerJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
    .where(
      and(
        eq(publishingSnapshotEntries.snapshotID, snapshot.id),
        eq(publishingSnapshotEntries.entryID, entryID)
      )
    );

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Published entry version not found" });
  }

  const contributors = await database
    .select({ membershipID: entryVersionContributors.membershipID })
    .from(entryVersionContributors)
    .where(
      and(
        eq(entryVersionContributors.workspaceID, workspaceID),
        eq(entryVersionContributors.versionID, row.version.id)
      )
    );

  return {
    collectionID: row.collectionID,
    snapshot,
    version: mapVersion(
      row.version,
      contributors.map(({ membershipID }) => membershipID)
    )
  };
};
const getPublishedEntryVersion = withAuthorization<
  PublishedEntryVersionInput,
  PublishedEntryVersionSource,
  VersionDetails
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "publishing:read", collectionID: resolved.collectionID }]
    }),
    includeDeleted: true,
    resolve: async ({ database, input, workspaceID }) => {
      const source = await loadPublishedEntryVersion(database, workspaceID, input);
      const [entry] = await database
        .select({ collectionID: entries.collectionID })
        .from(entries)
        .where(and(eq(entries.id, toUUID(input.entryID)), eq(entries.workspaceID, workspaceID)));

      if (!entry) {
        throw new ORPCError("NOT_FOUND", { message: "Published entry version not found" });
      }

      return { ...source, collectionID: entry.collectionID };
    }
  },
  async ({ resolved }) => resolved.version
);
export { getPublishedEntryVersion, loadPublishedEntryVersion };
