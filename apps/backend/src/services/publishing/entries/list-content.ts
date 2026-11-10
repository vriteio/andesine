import { publishingSnapshotEntries, entryVersions } from "@andesine/server/database";
import { loadPublishedContentPaths } from "@andesine/server/content";
import { type PropertyFilter } from "@andesine/contracts/search";
import { loadPublishedContentItems } from "#backend/lib/publishing/content-items";
import { getVersionPropertyFilter } from "#backend/lib/versioning/property-filters";
import { ORPCError } from "@orpc/server";
import { withPublicWorkspace } from "#backend/lib/policy";
import { assertInCollectionScope, resolveCollectionScope } from "#backend/lib/publishing";
import { DEFAULT_PAGE_SIZE } from "@andesine/contracts/limits";
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
} from "@andesine/contracts/primitives";
import { and, asc, eq, gt, isNull, inArray, or } from "drizzle-orm";
import type * as z from "zod";
import { type publishedEntryListType } from "@andesine/contracts/content";

interface PublishedEntryListInput extends PublishedPageInput {
  descendants?: boolean;
  includeContent?: boolean;
  filters?: PropertyFilter[];
  /** The collections that a publishable key can read. */
  collectionScope?: string[];
}

const listPublishedEntries = withPublicWorkspace<
  PublishedEntryListInput,
  z.infer<typeof publishedEntryListType>
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const snapshot = await resolvePublishedPage(database, workspaceID, input);
  const paths = await loadPublishedContentPaths(database, workspaceID, snapshot.id);
  const scopeID = paths.resolveCollection(input, false);
  const keyScope = resolveCollectionScope(paths, input.collectionScope);

  if (scopeID !== undefined) assertInCollectionScope(keyScope, scopeID);

  if (input.descendants && scopeID === undefined)
    throw new ORPCError("BAD_REQUEST", { message: "descendants requires a collection scope" });

  const collectionIDs =
    scopeID !== undefined
      ? [...(scopeID ? [scopeID] : []), ...(input.descendants ? paths.descendantIDs(scopeID) : [])]
      : [];
  // Without a selected collection, a publishable key lists the entries of its collections.
  const scopeFilter =
    scopeID === undefined
      ? keyScope && inArray(publishingSnapshotEntries.collectionID, [...keyScope])
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
      slugPath: paths.entrySlugPath(row.collectionID, row.name, row.id),
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
