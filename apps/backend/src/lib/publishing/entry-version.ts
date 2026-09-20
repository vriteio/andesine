import {
  assertSelector,
  loadPublishedContentPaths,
  type PublishedEntrySelector
} from "#backend/lib/content/paths";
import { publishingSnapshotEntries, entryVersionContributors, entryVersions } from "#backend/db";
import type { Database } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { normalizePublishingChannelCode } from "./channel";
import { PUBLISHED_CHANNEL_CODE } from "./config";
import { resolvePublishingSnapshot, type ResolvedPublishingSnapshot } from "./snapshot-state";

interface PublishedEntryVersionInput extends PublishedEntrySelector {
  channel?: string;
  snapshotID?: string;
}
interface PublishedEntryVersionSource {
  path: string;
  collectionID: string | null;
  snapshot: ResolvedPublishingSnapshot;
  version: typeof entryVersions.$inferSelect;
  contributorIDs: string[];
}

const loadPublishedEntryVersion = async (
  database: Database,
  workspaceID: string,
  input: PublishedEntryVersionInput
): Promise<PublishedEntryVersionSource> => {
  assertSelector(input.entryID, input.path);
  const snapshot = input.snapshotID
    ? await resolvePublishingSnapshot(database, workspaceID, { snapshotID: input.snapshotID })
    : await resolvePublishingSnapshot(database, workspaceID, {
        channelCode: normalizePublishingChannelCode(input.channel || PUBLISHED_CHANNEL_CODE)
      });
  const paths = await loadPublishedContentPaths(database, workspaceID, snapshot.id);
  const target = input.path !== undefined ? paths.resolveEntryPath(input.path) : null;
  const [row] = await database
    .select({ collectionID: publishingSnapshotEntries.collectionID, version: entryVersions })
    .from(publishingSnapshotEntries)
    .innerJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
    .where(
      and(
        eq(publishingSnapshotEntries.snapshotID, snapshot.id),
        input.entryID !== undefined
          ? eq(publishingSnapshotEntries.entryID, toUUID(input.entryID))
          : undefined,
        target ? eq(entryVersions.entryName, target.name) : undefined,
        target
          ? target.collectionID
            ? eq(publishingSnapshotEntries.collectionID, target.collectionID)
            : isNull(publishingSnapshotEntries.collectionID)
          : undefined
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
    path: paths.entryPath(row.collectionID, row.version.entryName),
    collectionID: row.collectionID,
    snapshot,
    version: row.version,
    contributorIDs: contributors.map(({ membershipID }) => membershipID)
  };
};
export { loadPublishedEntryVersion };
export type { PublishedEntryVersionInput, PublishedEntryVersionSource };
