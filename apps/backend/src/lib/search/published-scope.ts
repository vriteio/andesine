import { loadPublishedContentPaths, type CollectionSelector } from "#backend/lib/content/paths";
import { resolvePublishingSnapshot } from "#backend/lib/publishing/snapshot-state";
import { publishingChannels, publishingSnapshotEntries } from "#backend/db";
import type { SearchDocument } from "./types";
import type { Database } from "#backend/lib/policy";
import { toCollectionID, toUUID, toVersionID } from "#backend/lib/primitives";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { SearchDocumentAuthorizer } from "./retrieval";

const createDocumentAuthorizer = (
  channel: string,
  snapshotID: string,
  database: Database,
  workspaceID: string
): SearchDocumentAuthorizer => {
  return async (documents: SearchDocument[]): Promise<Set<string>> => {
    if (documents.length === 0) return new Set();

    const rows = await database
      .select({
        channelID: publishingChannels.id,
        entryID: publishingSnapshotEntries.entryID,
        snapshotID: publishingSnapshotEntries.snapshotID,
        versionID: publishingSnapshotEntries.versionID
      })
      .from(publishingSnapshotEntries)
      .innerJoin(
        publishingChannels,
        and(
          eq(publishingChannels.workspaceID, workspaceID),
          eq(publishingChannels.code, channel),
          eq(publishingChannels.currentSnapshotID, publishingSnapshotEntries.snapshotID),
          isNull(publishingChannels.deletedAt)
        )
      )
      .where(
        and(
          eq(publishingSnapshotEntries.workspaceID, workspaceID),
          eq(publishingSnapshotEntries.snapshotID, snapshotID),
          inArray(
            publishingSnapshotEntries.entryID,
            documents.map(({ entryID }) => toUUID(entryID))
          )
        )
      );
    const assignmentKeys = new Set(
      rows.map(({ channelID, entryID, snapshotID, versionID }) => {
        return `${entryID}:${channelID}:${snapshotID}:${toVersionID(versionID)}`;
      })
    );

    return new Set(
      documents.flatMap((document) => {
        if (document.scope !== "published") return [];

        const assignmentKey = `${toUUID(document.entryID)}:${document.channelID}:${toUUID(
          document.snapshotID
        )}:${document.versionID}`;

        return assignmentKeys.has(assignmentKey) ? [document.id] : [];
      })
    );
  };
};
const resolvePublishedScope = async (
  channel: string,
  input: CollectionSelector,
  database: Database,
  workspaceID: string
) => {
  const snapshot = await resolvePublishingSnapshot(database, workspaceID, { channelCode: channel });
  const paths = await loadPublishedContentPaths(database, workspaceID, snapshot.id);
  const scopeID = paths.resolveCollection(input, false);

  return { collectionID: scopeID ? toCollectionID(scopeID) : undefined, snapshotID: snapshot.id };
};

export { createDocumentAuthorizer, resolvePublishedScope };
