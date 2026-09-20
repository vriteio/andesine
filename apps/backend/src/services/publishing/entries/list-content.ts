import { loadPublishedContentItems } from "#backend/lib/publishing/content-items";
import { getVersionPropertyFilter } from "#backend/lib/versioning/property-filters";
import type { PropertyFilter } from "#backend/lib/content/properties";
import { ORPCError } from "@orpc/server";
import { loadPublishedContentPaths } from "#backend/lib/content/paths";
import { publishingSnapshotEntries, entryVersions } from "#backend/db";
import { withPublicWorkspace } from "#backend/lib/policy";
import { DEFAULT_PAGE_SIZE } from "#backend/lib/api/limits";
import { toPage } from "#backend/lib/api/pagination";
import {
  resolvePublishedPage,
  type PublishedPageInput
} from "#backend/lib/publishing/list-content";
import {
  toCollectionID,
  toSnapshotID,
  toUUID,
  toEntryID,
  toVersionID
} from "#backend/lib/primitives";
import { and, asc, eq, gt, isNull, inArray, or } from "drizzle-orm";
import type * as z from "zod";
import type { publishedEntryListType } from "#backend/contracts/schemas/content";

interface PublishedEntryListInput extends PublishedPageInput {
  descendants?: boolean;
  includeContent?: boolean;
  filters?: PropertyFilter[];
}

const listPublishedEntries = withPublicWorkspace<
  PublishedEntryListInput,
  z.infer<typeof publishedEntryListType>
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const snapshot = await resolvePublishedPage(database, workspaceID, input);
  const paths = await loadPublishedContentPaths(database, workspaceID, snapshot.id);
  const scopeID = paths.resolveCollection(input, false);
  if (input.descendants && scopeID === undefined)
    throw new ORPCError("BAD_REQUEST", { message: "descendants requires a collection scope" });

  const collectionIDs =
    scopeID !== undefined
      ? [...(scopeID ? [scopeID] : []), ...(input.descendants ? paths.descendantIDs(scopeID) : [])]
      : [];
  const scopeFilter =
    scopeID === undefined
      ? undefined
      : or(
          scopeID === null ? isNull(publishingSnapshotEntries.collectionID) : undefined,
          collectionIDs.length
            ? inArray(publishingSnapshotEntries.collectionID, collectionIDs)
            : undefined
        );
  const rows = await database
    .select({
      id: publishingSnapshotEntries.entryID,
      collectionID: publishingSnapshotEntries.collectionID,
      name: entryVersions.entryName,
      versionID: entryVersions.id,
      hash: entryVersions.hash
    })
    .from(publishingSnapshotEntries)
    .innerJoin(
      entryVersions,
      and(
        eq(entryVersions.id, publishingSnapshotEntries.versionID),
        eq(entryVersions.workspaceID, workspaceID)
      )
    )
    .where(
      and(
        eq(publishingSnapshotEntries.workspaceID, workspaceID),
        eq(publishingSnapshotEntries.snapshotID, snapshot.id),
        scopeFilter,
        getVersionPropertyFilter({
          workspaceID,
          versionID: publishingSnapshotEntries.versionID,
          filters: input.filters || []
        }),
        input.cursor ? gt(publishingSnapshotEntries.entryID, toUUID(input.cursor)) : undefined
      )
    )
    .orderBy(asc(publishingSnapshotEntries.entryID))
    .limit(limit + 1);

  const page = toPage(
    rows.map((row) => ({
      id: toEntryID(row.id),
      collectionID: row.collectionID ? toCollectionID(row.collectionID) : null,
      name: row.name,
      path: paths.entryPath(row.collectionID, row.name),
      version: { id: toVersionID(row.versionID), hash: row.hash }
    })),
    limit
  );

  return {
    ...page,
    data: input.includeContent
      ? await loadPublishedContentItems(database, workspaceID, snapshot.id, page.data)
      : page.data,
    channel: snapshot.channelCode,
    snapshotID: toSnapshotID(snapshot.id),
    expiresAt: snapshot.expiresAt
  };
});

export { listPublishedEntries };
