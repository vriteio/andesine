import { collectionType, entryType } from "#backend/db";
import { collectionAccessType } from "#backend/lib/policy/actions";
import { id, publicID } from "#backend/lib/primitives";
import { publishingChannelCodeType } from "#backend/lib/publishing/channel";
import { PUBLISHED_CHANNEL_CODE } from "#backend/lib/publishing/config";
import { type } from "@orpc/contract";
import * as z from "zod";
import { authenticatedContract, baseContract, sessionContract } from "./base";

const explorerTreeType = z.object({
  collections: z.array(collectionType),
  entries: z.array(entryType),
  accessByCollectionID: z.record(id(), collectionAccessType),
  workspaceContentAccess: collectionAccessType,
  topLevelCollectionIDs: z.array(id()),
  activeSchemaMigrations: z.array(
    z.object({
      id: id(),
      collectionIDs: z.array(id()),
      processedEntries: z.number().int().nonnegative(),
      status: z.enum(["queued", "running", "rolling_back"]),
      totalEntries: z.number().int().nonnegative()
    })
  ),
  schemas: z.array(
    z.object({
      id: id(),
      collectionID: id(),
      enabled: z.boolean(),
      hasActiveVersion: z.boolean(),
      hasUnappliedChanges: z.boolean()
    })
  ),
  publishing: z
    .object({
      enabledCollectionIDs: z.array(id()),
      neverPublishedCollectionIDs: z.array(id()),
      neverPublishedEntryIDs: z.array(id()),
      unpublishedCollectionIDs: z.array(id()),
      unpublishedEntryIDs: z.array(id())
    })
    .nullable()
});
const publishingEntryOverlayType = z.object({
  canReadVersions: z.boolean(),
  canUnpublish: z.boolean(),
  channel: publishingChannelCodeType,
  collectionID: id().nullable(),
  entryID: id(),
  name: z.string(),
  order: z.string(),
  publishingCollectionID: id().nullable(),
  publishingCollectionName: z.string().nullable(),
  reason: z.enum(["deleted", "moved"]),
  snapshotCollectionID: id().nullable(),
  snapshotID: publicID("snp"),
  versionID: id(),
  workingCollectionID: id().nullable()
});
const publishingCollectionOverlayType = z.object({
  canUnpublish: z.boolean(),
  channel: publishingChannelCodeType,
  collectionID: id(),
  name: z.string(),
  order: z.string(),
  parentID: id().nullable(),
  publishingCollectionID: id(),
  publishingCollectionName: z.string(),
  snapshotID: publicID("snp")
});
const publishingExplorerOverlayType = z.object({
  collections: z.array(publishingCollectionOverlayType),
  entries: z.array(publishingEntryOverlayType)
});
const syncContract = baseContract.router({
  setCurrentEntry: sessionContract
    .input(
      z.object({
        entryID: id().describe("ID of the entry that the member opened")
      })
    )
    .output(z.void()),
  getExplorerTree: sessionContract.output(explorerTreeType),
  getExplorerOverlay: sessionContract
    .input(z.object({ channel: publishingChannelCodeType }))
    .output(publishingExplorerOverlayType),
  getPublishingStatus: sessionContract
    .input(
      z.object({
        channel: publishingChannelCodeType.optional().default(PUBLISHED_CHANNEL_CODE)
      })
    )
    .output(
      z.object({
        channel: publishingChannelCodeType,
        neverPublishedCollectionIDs: z.array(id()),
        neverPublishedEntryIDs: z.array(id()),
        publishedEntryRoots: z.array(
          z.object({
            collectionID: id(),
            entryID: id(),
            name: z.string()
          })
        ),
        publishedCollectionRoots: z.array(
          z.object({
            collectionID: id(),
            publishingCollectionID: id()
          })
        ),
        unpublishedCollectionIDs: z.array(id()),
        unpublishedEntryIDs: z.array(id())
      })
    ),
  workspaceUpdates: authenticatedContract.output(type<AsyncGenerator<unknown, void, unknown>>())
});

export { syncContract };
