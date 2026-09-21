import {
  publishingSnapshotCollections,
  publishingSnapshotEntries,
  entryVersions
} from "#backend/db";
import type {
  PublishedTypeMetadataInput,
  TypeMetadata
} from "#backend/contracts/schemas/type-metadata";
import { withAuthorization } from "#backend/lib/policy";
import { toSnapshotID } from "#backend/lib/primitives";
import { resolvePublishingSnapshot } from "#backend/lib/publishing/snapshot-state";
import { PUBLISHED_CHANNEL_CODE } from "#backend/lib/publishing/config";
import { selectMetadataCollections } from "#backend/lib/type-metadata/selection";
import { createMetadataResult } from "#backend/lib/type-metadata/result";
import { loadMetadataRevisions } from "#backend/lib/type-metadata/revisions";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

const getPublished = withAuthorization<PublishedTypeMetadataInput, undefined, TypeMetadata>(
  {
    transaction: "snapshot",
    permissions: { key: ["read:publishing"] }
  },
  async ({ database, input, auth, workspaceID }) => {
    const snapshot = await resolvePublishingSnapshot(
      database,
      workspaceID,
      input.snapshotID
        ? { snapshotID: input.snapshotID }
        : { channelCode: input.channel ?? PUBLISHED_CHANNEL_CODE }
    );
    const rows = await database
      .select({
        id: publishingSnapshotCollections.collectionID,
        parentID: publishingSnapshotCollections.parentID,
        name: publishingSnapshotCollections.name,
        rank: publishingSnapshotCollections.rank
      })
      .from(publishingSnapshotCollections)
      .where(
        and(
          eq(publishingSnapshotCollections.workspaceID, workspaceID),
          eq(publishingSnapshotCollections.snapshotID, snapshot.id)
        )
      );
    const selected = selectMetadataCollections({ rows, selectors: input.collections });
    const selectedIDs = selected.collections.flatMap((row) => (row.id ? [row.id] : []));
    const includeRoot = selected.collections.some((row) => row.id === null);
    const scope = and(
      eq(publishingSnapshotEntries.workspaceID, workspaceID),
      eq(publishingSnapshotEntries.snapshotID, snapshot.id),
      or(
        selectedIDs.length
          ? inArray(publishingSnapshotEntries.collectionID, selectedIDs)
          : undefined,
        includeRoot ? isNull(publishingSnapshotEntries.collectionID) : undefined
      )
    );
    const versionJoin = and(
      eq(entryVersions.workspaceID, publishingSnapshotEntries.workspaceID),
      eq(entryVersions.entryID, publishingSnapshotEntries.entryID),
      eq(entryVersions.id, publishingSnapshotEntries.versionID)
    );
    const associations =
      selectedIDs.length || includeRoot
        ? await database
            .selectDistinct({
              collectionID: publishingSnapshotEntries.collectionID,
              schemaRevisionID: entryVersions.schemaRevisionID
            })
            .from(publishingSnapshotEntries)
            .innerJoin(entryVersions, versionJoin)
            .where(scope)
        : [];
    const revisions = await loadMetadataRevisions(
      database,
      workspaceID,
      associations.flatMap((row) => (row.schemaRevisionID ? [row.schemaRevisionID] : []))
    );
    const includeEntries = input.includeEntries || input.includeTree;
    const entryRows =
      includeEntries && (selectedIDs.length || includeRoot)
        ? await database
            .select({
              id: publishingSnapshotEntries.entryID,
              collectionID: publishingSnapshotEntries.collectionID,
              name: entryVersions.entryName,
              rank: publishingSnapshotEntries.rank,
              schemaRevisionID: entryVersions.schemaRevisionID
            })
            .from(publishingSnapshotEntries)
            .innerJoin(entryVersions, versionJoin)
            .where(scope)
        : [];

    return createMetadataResult({
      workspaceID: auth.workspaceID,
      source: {
        kind: "published",
        channel: snapshot.channelCode,
        snapshotID: toSnapshotID(snapshot.id),
        expiresAt: snapshot.expiresAt
      },
      options: input,
      ...selected,
      associations,
      revisions,
      entries: entryRows
    });
  }
);

export { getPublished };
