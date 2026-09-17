import {
  publishingChannels,
  publishingSnapshotCollections,
  publishingSnapshotEntries
} from "#backend/db";
import type {
  AskResult,
  PublishedAskInput,
  PublishedSearchInput,
  SearchDocument,
  SearchResult
} from "#backend/lib/search";
import { type Database, withAuthorization } from "#backend/lib/policy";
import { normalizePublishingChannelCode } from "#backend/lib/publishing";
import { toUUID, toVersionID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ask, search, type SearchDocumentAuthorizer } from "./core";

const createDocumentAuthorizer = (
  channel: string,
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
const assertPublishedCollectionFilter = async (
  channel: string,
  collectionID: string | undefined,
  database: Database,
  workspaceID: string
): Promise<void> => {
  if (!collectionID) return;

  const [collection] = await database
    .select({ id: publishingSnapshotCollections.collectionID })
    .from(publishingSnapshotCollections)
    .innerJoin(
      publishingChannels,
      and(
        eq(publishingChannels.workspaceID, workspaceID),
        eq(publishingChannels.code, channel),
        eq(publishingChannels.currentSnapshotID, publishingSnapshotCollections.snapshotID),
        isNull(publishingChannels.deletedAt)
      )
    )
    .where(
      and(
        eq(publishingSnapshotCollections.collectionID, toUUID(collectionID)),
        eq(publishingSnapshotCollections.workspaceID, workspaceID)
      )
    )
    .limit(1);

  if (!collection) throw new ORPCError("NOT_FOUND");
};

const searchPublished = withAuthorization<PublishedSearchInput, undefined, SearchResult>(
  {
    permissions: { session: true, key: ["read:publishing"] }
  },
  async ({ auth, database, input, workspaceID }) => {
    const channel = normalizePublishingChannelCode(input.channel);

    await assertPublishedCollectionFilter(channel, input.collectionID, database, workspaceID);

    return search({
      ...input,
      channel,
      authorizeDocuments: createDocumentAuthorizer(channel, database, workspaceID),
      scope: "published",
      workspaceID: auth.workspaceID
    });
  }
);
const askPublished = withAuthorization<PublishedAskInput, undefined, AskResult>(
  {
    permissions: { session: true }
  },
  async ({ auth, database, input, workspaceID }) => {
    const channel = normalizePublishingChannelCode(input.channel);

    await assertPublishedCollectionFilter(channel, input.collectionID, database, workspaceID);

    return ask({
      ...input,
      channel,
      authorizeDocuments: createDocumentAuthorizer(channel, database, workspaceID),
      query: input.question,
      scope: "published",
      workspaceID: auth.workspaceID
    });
  }
);

export { askPublished, searchPublished };
