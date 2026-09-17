import { collectionType, entryType } from "#backend/db";
import { collectionAccessType } from "#backend/lib/policy";
import { id, publicID } from "#backend/lib/primitives";
import { PUBLISHED_CHANNEL_CODE, publishingChannelCodeType } from "#backend/lib/publishing";
import { authenticatedRoute, base, sessionRoute } from "#backend/lib/transport";
import { Memberships } from "#backend/services/memberships";
import { Sync } from "#backend/services/sync";
import * as z from "zod";

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

const syncRouter = base.router({
  setCurrentEntry: sessionRoute
    .input(
      z.object({
        entryID: id().describe("ID of the entry that the member opened")
      })
    )
    .output(z.void())
    .handler(({ context, input }) => {
      return Memberships.setCurrentEntry({
        auth: context.auth,
        entryID: input.entryID
      });
    }),
  getExplorerTree: sessionRoute.output(explorerTreeType).handler(async ({ context }) => {
    return Sync.getExplorerTree({
      auth: context.auth,
      includePublishing: true
    });
  }),
  getExplorerOverlay: sessionRoute
    .input(z.object({ channel: publishingChannelCodeType }))
    .output(publishingExplorerOverlayType)
    .handler(({ context, input }) => {
      return Sync.getExplorerOverlay({
        auth: context.auth,
        channel: input.channel
      });
    }),
  getPublishingStatus: sessionRoute
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
    )
    .handler(async ({ context, input }) => {
      return Sync.getPublishingStatus({
        auth: context.auth,
        channel: input.channel
      });
    }),
  workspaceUpdates: authenticatedRoute.handler(async function* ({ context, signal }) {
    const { events } = await Sync.listenToWorkspaceEvents({
      auth: context.auth,
      signal
    });

    yield* events;
  })
});

export { syncRouter };
