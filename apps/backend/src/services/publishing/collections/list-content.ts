import { loadPublishedContentPaths } from "#backend/lib/content/paths";
import { publishingSnapshotCollections } from "#backend/db";
import { withPublicWorkspace } from "#backend/lib/policy";
import { DEFAULT_PAGE_SIZE } from "#backend/lib/api/limits";
import { toPage } from "#backend/lib/api/pagination";
import {
  resolvePublishedPage,
  type PublishedPageInput
} from "#backend/lib/publishing/list-content";
import { toCollectionID, toSnapshotID, toUUID } from "#backend/lib/primitives";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import type * as z from "zod";
import type { publishedCollectionListType } from "#backend/contracts/schemas/content";

const listPublishedCollections = withPublicWorkspace<
  PublishedPageInput,
  z.infer<typeof publishedCollectionListType>
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const snapshot = await resolvePublishedPage(database, workspaceID, input);
  const paths = await loadPublishedContentPaths(database, workspaceID, snapshot.id);
  const scopeID = paths.resolveCollection(input, false);
  const rows = await database
    .select({
      id: publishingSnapshotCollections.collectionID,
      parentID: publishingSnapshotCollections.parentID,
      name: publishingSnapshotCollections.name
    })
    .from(publishingSnapshotCollections)

    .where(
      and(
        eq(publishingSnapshotCollections.workspaceID, workspaceID),
        eq(publishingSnapshotCollections.snapshotID, snapshot.id),
        scopeID === undefined
          ? undefined
          : scopeID === null
            ? isNull(publishingSnapshotCollections.parentID)
            : eq(publishingSnapshotCollections.parentID, scopeID),
        input.cursor
          ? gt(publishingSnapshotCollections.collectionID, toUUID(input.cursor))
          : undefined
      )
    )
    .orderBy(asc(publishingSnapshotCollections.collectionID))
    .limit(limit + 1);

  return {
    ...toPage(
      rows.map((row) => ({
        id: toCollectionID(row.id),
        parentID: row.parentID ? toCollectionID(row.parentID) : null,
        name: row.name,
        path: paths.collectionPath(row.id)
      })),
      limit
    ),
    channel: snapshot.channelCode,
    snapshotID: toSnapshotID(snapshot.id),
    expiresAt: snapshot.expiresAt
  };
});

export { listPublishedCollections };
