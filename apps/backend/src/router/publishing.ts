import { versionDetailsType, versionSummaryType } from "#backend/lib/data";
import {
  emitCollectionEvent,
  emitEntryEvent,
  emitPublishingEntryUpdates,
  emitPublishingEvent,
  emitPublishingSnapshotAdvance,
  emitSchemaEvent,
  emitVersionCreationEvents
} from "#backend/events";
import {
  type CommitPublishingSnapshotResult,
  PUBLISHED_CHANNEL_CODE,
  publishingChannelCodeType,
  publishingChannelNameType
} from "#backend/lib/publishing";
import { id, publicID } from "#backend/lib/primitives";
import {
  enqueueCurrentCollectionSync,
  enqueueCurrentEntrySync,
  enqueuePublishedChannelPurge,
  enqueuePublishedEntrySync
} from "#backend/lib/queue";
import { authenticatedRoute, base } from "#backend/lib/transport";
import { Publishing } from "#backend/services/publishing";
import { ORPCError } from "@orpc/server";
import * as z from "zod";

interface PublishingSnapshotUpdateInput {
  channel: string;
  memberID?: string;
  snapshot: CommitPublishingSnapshotResult | null;
  workspaceID: string;
}

const publishingChannelType = z.object({
  code: publishingChannelCodeType.describe("Publishing channel API identifier"),
  name: publishingChannelNameType.describe("Publishing channel label"),
  builtIn: z.boolean().describe("Whether the channel is built in"),
  createdAt: z.iso.datetime().describe("Time when the channel was created"),
  updatedAt: z.iso.datetime().describe("Time when the channel was last updated")
});
const entryPublicationChannelType = publishingChannelType.pick({
  builtIn: true,
  code: true,
  name: true
});
const entryPublicationType = z.object({
  channel: entryPublicationChannelType,
  publishedAt: z.iso.datetime().describe("Time when the version was published"),
  version: versionSummaryType
});
const publishingChannelListItemType = publishingChannelType.extend({
  assignmentCount: z.number().int().min(0).optional()
});
const channelContentEntryType = z.object({
  canPublish: z.boolean().describe("Whether current permissions allow publishing this entry"),
  canRevert: z.boolean().describe("Whether current permissions allow reverting this entry"),
  canUnpublish: z.boolean().describe("Whether current permissions allow unpublishing this entry"),
  collectionID: id().nullable().describe("Current working collection"),
  deleted: z.boolean().describe("Whether the working entry is deleted"),
  entryID: id(),
  name: z.string(),
  publishedAt: z.iso.datetime().nullable(),
  rank: z.string(),
  status: z.enum(["changes", "pending-publish", "pending-removal", "published"]),
  treeCollectionID: id().nullable().describe("Collection used to place the entry in the tree"),
  versionID: id().nullable().describe("Version selected by the current snapshot")
});
const channelContentCollectionType = z.object({
  canPublish: z.boolean().describe("Whether current permissions allow publishing this collection"),
  canRevert: z.boolean().describe("Whether current permissions allow reverting this collection"),
  canUnpublish: z
    .boolean()
    .describe("Whether current permissions allow unpublishing this collection"),
  collectionID: id(),
  deleted: z.boolean().describe("Whether the working collection is deleted"),
  name: z.string(),
  parentID: id().nullable(),
  rank: z.string(),
  status: z.enum(["changes", "pending-publish", "pending-removal", "published"])
});
const channelContentType = z.object({
  channel: publishingChannelCodeType,
  collections: z.array(channelContentCollectionType),
  entries: z.array(channelContentEntryType),
  snapshotID: publicID("snp")
});
const channelInput = z.object({
  channel: publishingChannelCodeType
    .optional()
    .default(PUBLISHED_CHANNEL_CODE)
    .describe("Publishing channel, defaults to published")
});
const publishEntryTargetType = z.object({
  entryID: id().describe("Entry to publish"),
  versionID: id().optional().describe("Existing version to publish")
});
const revertPublishingChangesInputType = channelInput
  .extend({
    all: z.boolean().optional().describe("Whether to revert all pending changes"),
    collectionID: id().describe("Publishing root collection"),
    collectionIDs: z.array(id()).optional().describe("Collections whose changes to revert"),
    entryIDs: z.array(id()).optional().describe("Entries whose changes to revert"),
    snapshotID: publicID("snp").describe("Snapshot used to review the changes")
  })
  .refine(
    ({ all, collectionIDs, entryIDs }) => {
      const hasSelection = Boolean(collectionIDs?.length || entryIDs?.length);

      return all === true ? !hasSelection : hasSelection;
    },
    { message: "Select all changes or specific items" }
  );
const revertPublishingChangesResultType = z.object({
  affectedEntryIDs: z.array(id()),
  deletedEntryIDs: z.array(id()),
  noOp: z.boolean(),
  restoredEntryIDs: z.array(id()),
  versionedEntryIDs: z.array(id())
});
const getContributorIDs = (auth: { session?: { memberID: string } }): string[] => {
  return auth.session ? [auth.session.memberID] : [];
};
const handlePublishingSnapshotUpdate = async (
  input: PublishingSnapshotUpdateInput
): Promise<void> => {
  const snapshot = input.snapshot;

  if (!snapshot?.created) return;

  emitPublishingSnapshotAdvance({
    workspaceID: input.workspaceID,
    channel: input.channel,
    collectionIDs: snapshot.affectedCollectionIDs,
    entryIDs: snapshot.affectedEntryIDs,
    memberID: input.memberID,
    previousSnapshotID: snapshot.previousSnapshotID,
    snapshotID: snapshot.snapshotID
  });
  await enqueuePublishedEntrySync({
    workspaceID: input.workspaceID,
    entryIDs: snapshot.searchSyncEntryIDs
  });
};
const publishingRouter = base.prefix("/publishing").router({
  setCollection: authenticatedRoute
    .route({ method: "PUT", path: "/collections/:collectionID" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      z.object({
        collectionID: id().describe("Collection to configure"),
        enabled: z
          .boolean()
          .describe(
            "Enable publishing, or disable and unpublish the collection tree from all channels"
          ),
        publish: z
          .boolean()
          .optional()
          .describe("Whether to publish latest entry versions when enabling publishing")
      })
    )
    .output(
      z.object({
        publishedEntries: z.number().int().min(0).describe("Number of entries published")
      })
    )
    .handler(async ({ context, input }) => {
      const [result] = await Publishing.Collections.set({
        auth: context.auth,
        collectionIDs: [input.collectionID],
        enabled: input.enabled,
        publish: input.publish,
        contributorIDs: getContributorIDs(context.auth)
      });

      if (result.changed) {
        emitPublishingEvent(context.auth.workspaceID, {
          action: "publishing:collection-update",
          data: { id: input.collectionID, enabled: input.enabled },
          memberID: context.auth.session?.memberID
        });
      }

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        memberID: context.auth.session?.memberID
      });
      emitVersionCreationEvents(
        context.auth.workspaceID,
        result.createdVersions,
        context.auth.session?.memberID
      );
      await Promise.all(
        result.snapshots.map(({ channel, snapshot }) =>
          handlePublishingSnapshotUpdate({
            workspaceID: context.auth.workspaceID,
            channel,
            memberID: context.auth.session?.memberID,
            snapshot
          })
        )
      );

      return { publishedEntries: result.publishedEntries };
    }),
  bulkSetCollections: authenticatedRoute
    .route({ method: "POST", path: "/collections/bulk/set" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      z.object({
        ids: z.array(id()).min(1).describe("IDs of the collections to configure"),
        enabled: z
          .boolean()
          .describe(
            "Enable publishing, or disable and unpublish the collection trees from all channels"
          ),
        publish: z
          .boolean()
          .optional()
          .describe("Whether to publish latest entry versions when enabling publishing")
      })
    )
    .output(
      z.object({
        publishedEntries: z.number().int().min(0).describe("Number of entries published")
      })
    )
    .handler(async ({ context, input }) => {
      const results = await Publishing.Collections.set({
        auth: context.auth,
        collectionIDs: input.ids,
        enabled: input.enabled,
        publish: input.publish,
        contributorIDs: getContributorIDs(context.auth)
      });
      const publishedEntries = results.reduce((total, result) => {
        return total + result.publishedEntries;
      }, 0);

      for (const result of results) {
        if (result.changed) {
          emitPublishingEvent(context.auth.workspaceID, {
            action: "publishing:collection-update",
            data: { id: result.collectionID, enabled: input.enabled },
            memberID: context.auth.session?.memberID
          });
        }

        emitPublishingEntryUpdates({
          workspaceID: context.auth.workspaceID,
          entries: result.publishingEntries,
          memberID: context.auth.session?.memberID
        });
        emitVersionCreationEvents(
          context.auth.workspaceID,
          result.createdVersions,
          context.auth.session?.memberID
        );
      }
      await Promise.all(
        results
          .flatMap((result) => result.snapshots)
          .map(({ channel, snapshot }) => {
            return handlePublishingSnapshotUpdate({
              workspaceID: context.auth.workspaceID,
              channel,
              memberID: context.auth.session?.memberID,
              snapshot
            });
          })
      );

      return { publishedEntries };
    }),
  publishCollection: authenticatedRoute
    .route({ method: "POST", path: "/collections/:collectionID" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        collectionID: id().describe("Collection tree to publish")
      })
    )
    .output(
      z.object({
        publishedEntries: z.number().int().min(0).describe("Number of entries published")
      })
    )
    .handler(async ({ context, input }) => {
      const result = await Publishing.Collections.publish({
        auth: context.auth,
        collectionIDs: [input.collectionID],
        channel: input.channel,
        contributorIDs: getContributorIDs(context.auth)
      });

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });

      emitVersionCreationEvents(
        context.auth.workspaceID,
        result.createdVersions,
        context.auth.session?.memberID
      );
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });

      return { publishedEntries: result.publishedEntries };
    }),
  bulkPublishCollections: authenticatedRoute
    .route({ method: "POST", path: "/collections/bulk/publish" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        ids: z.array(id()).min(1).describe("IDs of the collection trees to publish")
      })
    )
    .output(
      z.object({
        publishedEntries: z.number().int().min(0).describe("Number of entries published")
      })
    )
    .handler(async ({ context, input }) => {
      const result = await Publishing.Collections.publish({
        auth: context.auth,
        collectionIDs: input.ids,
        channel: input.channel,
        contributorIDs: getContributorIDs(context.auth)
      });

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });

      emitVersionCreationEvents(
        context.auth.workspaceID,
        result.createdVersions,
        context.auth.session?.memberID
      );
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });

      return { publishedEntries: result.publishedEntries };
    }),
  unpublishCollection: authenticatedRoute
    .route({ method: "DELETE", path: "/collections/:collectionID" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        collectionID: id().describe("Collection tree to unpublish")
      })
    )
    .output(
      z.object({
        unpublishedEntries: z.number().int().min(0).describe("Number of entries unpublished")
      })
    )
    .handler(async ({ context, input }) => {
      const result = await Publishing.Collections.unpublish({
        auth: context.auth,
        collectionIDs: [input.collectionID],
        channel: input.channel
      });

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });

      return { unpublishedEntries: result.unpublishedEntries };
    }),
  bulkUnpublishCollections: authenticatedRoute
    .route({ method: "POST", path: "/collections/bulk/unpublish" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        ids: z.array(id()).min(1).describe("IDs of the collection trees to unpublish")
      })
    )
    .output(
      z.object({
        unpublishedEntries: z.number().int().min(0).describe("Number of entries unpublished")
      })
    )
    .handler(async ({ context, input }) => {
      const result = await Publishing.Collections.unpublish({
        auth: context.auth,
        collectionIDs: input.ids,
        channel: input.channel
      });

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });

      return { unpublishedEntries: result.unpublishedEntries };
    }),
  publishEntry: authenticatedRoute
    .route({ method: "POST", path: "/entries/:entryID" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        entryID: id().describe("Entry to publish"),
        versionID: id().optional().describe("Existing version to publish")
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      const result = await Publishing.Entries.publish({
        auth: context.auth,
        entries: [{ entryID: input.entryID, versionID: input.versionID }],
        channel: input.channel,
        contributorIDs: getContributorIDs(context.auth)
      });

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });

      emitVersionCreationEvents(
        context.auth.workspaceID,
        result.createdVersions,
        context.auth.session?.memberID
      );
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });
    }),
  bulkPublishEntries: authenticatedRoute
    .route({ method: "POST", path: "/entries/bulk/publish" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        entries: z.array(publishEntryTargetType).min(1).describe("Entries and versions to publish")
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      const result = await Publishing.Entries.publish({
        auth: context.auth,
        entries: input.entries,
        channel: input.channel,
        contributorIDs: getContributorIDs(context.auth)
      });

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });

      emitVersionCreationEvents(
        context.auth.workspaceID,
        result.createdVersions,
        context.auth.session?.memberID
      );
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });
    }),
  unpublishEntry: authenticatedRoute
    .route({ method: "DELETE", path: "/entries/:entryID" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        entryID: id().describe("Entry to unpublish"),
        versionID: id().optional().describe("Version expected to be assigned")
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      const result = await Publishing.Entries.unpublish({
        auth: context.auth,
        entryIDs: [input.entryID],
        versionID: input.versionID,
        channel: input.channel
      });

      if (input.versionID && !result.removed) {
        throw new ORPCError("CONFLICT", { message: "Publishing assignment changed" });
      }

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });
    }),
  bulkUnpublishEntries: authenticatedRoute
    .route({ method: "POST", path: "/entries/bulk/unpublish" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(
      channelInput.extend({
        ids: z.array(id()).min(1).describe("IDs of the entries to unpublish")
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      const result = await Publishing.Entries.unpublish({
        auth: context.auth,
        entryIDs: input.ids,
        channel: input.channel
      });

      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID: context.auth.session?.memberID
      });
      await handlePublishingSnapshotUpdate({
        workspaceID: context.auth.workspaceID,
        channel: input.channel,
        memberID: context.auth.session?.memberID,
        snapshot: result.snapshot
      });
    }),
  revertChanges: authenticatedRoute
    .route({ method: "POST", path: "/changes/revert" })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(revertPublishingChangesInputType)
    .output(revertPublishingChangesResultType)
    .handler(async ({ context, input }) => {
      const result = await Publishing.Changes.revert({
        ...input,
        auth: context.auth,
        contributorIDs: getContributorIDs(context.auth)
      });
      const workspaceID = context.auth.workspaceID;
      const memberID = context.auth.session?.memberID;
      const collectionStatesByID = new Map(
        result.collectionStates.map((state) => [state.collection.id, state])
      );
      const entryStatesByID = new Map(result.entryStates.map((entry) => [entry.id, entry]));

      for (const collectionID of result.restoredCollectionIDs) {
        const state = collectionStatesByID.get(collectionID);

        if (!state) continue;

        emitCollectionEvent(workspaceID, {
          action: "collection:restore",
          data: state,
          memberID
        });
      }

      for (const schema of result.restoredSchemas) {
        emitSchemaEvent(workspaceID, {
          action: "schema:update",
          data: schema,
          memberID
        });
      }

      for (const collectionID of result.updatedCollectionIDs) {
        const state = collectionStatesByID.get(collectionID);

        if (!state) continue;

        emitCollectionEvent(workspaceID, {
          action: "collection:update",
          data: { id: collectionID, name: state.collection.name },
          memberID
        });
      }

      for (const collectionID of result.movedCollectionIDs) {
        const state = collectionStatesByID.get(collectionID);

        if (!state) continue;

        emitCollectionEvent(workspaceID, {
          action: "collection:move",
          data: {
            id: collectionID,
            index: state.index,
            newParentID: state.parentID,
            restrictedBoundaryChanged: true
          },
          memberID
        });
      }

      for (const entryID of result.restoredEntryIDs) {
        const entry = entryStatesByID.get(entryID);

        if (!entry) continue;

        emitEntryEvent(workspaceID, {
          action: "entry:restore",
          data: entry,
          memberID
        });
      }

      for (const entryID of result.updatedEntryIDs) {
        const entry = entryStatesByID.get(entryID);

        if (!entry) continue;

        emitEntryEvent(workspaceID, {
          action: "entry:update",
          data: { id: entryID, name: entry.name },
          memberID
        });
      }

      for (const entryID of result.movedEntryIDs) {
        const entry = entryStatesByID.get(entryID);

        if (!entry) continue;

        emitEntryEvent(workspaceID, {
          action: "entry:move",
          data: {
            id: entryID,
            collectionID: entry.collectionID ?? null,
            order: entry.order,
            restrictedBoundaryChanged: true
          },
          memberID
        });
      }

      if (result.deletedEntryIDs.length > 0) {
        emitEntryEvent(workspaceID, {
          action: "entry:delete",
          data: { ids: result.deletedEntryIDs },
          memberID
        });
      }

      if (result.deletedCollectionIDs.length > 0) {
        emitCollectionEvent(workspaceID, {
          action: "collection:delete",
          data: { ids: result.deletedCollectionIDs },
          memberID
        });
      }

      // Final sibling indices cannot be applied as independent moves in arbitrary order.
      for (const update of result.collectionOrderUpdates) {
        emitCollectionEvent(workspaceID, {
          action: "collection:reorder",
          data: update,
          memberID
        });
      }

      for (const entryID of result.contentResetEntryIDs) {
        emitEntryEvent(workspaceID, {
          action: "entry:content-reset",
          data: { id: entryID }
        });
      }

      for (const collection of result.publishingCollections) {
        emitPublishingEvent(workspaceID, {
          action: "publishing:collection-update",
          data: { id: collection.collectionID, enabled: collection.enabled },
          memberID
        });
      }

      emitPublishingEntryUpdates({
        workspaceID,
        entries: result.publishingEntries,
        channel: input.channel,
        memberID
      });
      emitVersionCreationEvents(workspaceID, result.createdVersions, memberID);

      const affectedEntryIDs = [
        ...new Set([
          ...result.deletedEntryIDs,
          ...result.restoredEntryIDs,
          ...result.updatedEntryIDs,
          ...result.movedEntryIDs
        ])
      ];
      const affectedCollectionIDs = [
        ...new Set([
          ...result.deletedCollectionIDs,
          ...result.restoredCollectionIDs,
          ...result.updatedCollectionIDs,
          ...result.movedCollectionIDs
        ])
      ];

      await Promise.all([
        enqueueCurrentEntrySync({ workspaceID, entryIDs: affectedEntryIDs }),
        ...affectedCollectionIDs.map((collectionID) => {
          return enqueueCurrentCollectionSync({ workspaceID, collectionID });
        })
      ]);

      return {
        affectedEntryIDs,
        deletedEntryIDs: result.deletedEntryIDs,
        noOp: result.noOp,
        restoredEntryIDs: result.restoredEntryIDs,
        versionedEntryIDs: [...new Set(result.createdVersions.map(({ entryID }) => entryID))]
      };
    }),
  getEntryVersion: authenticatedRoute
    .route({ method: "GET", path: "/entries/:entryID/version" })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(
      channelInput.extend({
        entryID: id().describe("Entry whose published version to get"),
        snapshotID: publicID("snp").optional().describe("Exact publication snapshot to read")
      })
    )
    .output(versionDetailsType)
    .handler(({ context, input }) => {
      return Publishing.Entries.getVersion({
        auth: context.auth,
        entryID: input.entryID,
        channel: input.channel,
        snapshotID: input.snapshotID
      });
    }),
  listEntryPublications: authenticatedRoute
    .route({ method: "GET", path: "/entries/:entryID/publications" })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(z.object({ entryID: id().describe("Entry whose publications to list") }))
    .output(z.array(entryPublicationType))
    .handler(({ context, input }) => {
      return Publishing.Entries.listPublications({
        auth: context.auth,
        entryID: input.entryID
      });
    }),
  listChannels: authenticatedRoute
    .route({ method: "GET", path: "/channels" })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(
      z.object({
        includeAssignmentCount: z
          .boolean()
          .optional()
          .describe("Whether to include the number of assigned entries")
      })
    )
    .output(z.array(publishingChannelListItemType))
    .handler(({ context, input }) => {
      return Publishing.Channels.list({
        auth: context.auth,
        includeAssignmentCount: input.includeAssignmentCount
      });
    }),
  getChannelContent: authenticatedRoute
    .route({ method: "GET", path: "/channels/:channel/content" })
    .meta({ required: { session: true, key: ["read:publishing"] } })
    .input(
      z.object({
        channel: publishingChannelCodeType,
        collectionID: id().describe("Publishing root collection whose content to list")
      })
    )
    .output(channelContentType)
    .handler(({ context, input }) => {
      return Publishing.Channels.getContent({
        auth: context.auth,
        channel: input.channel,
        collectionID: input.collectionID
      });
    }),
  createChannel: authenticatedRoute
    .route({ method: "POST", path: "/channels" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(z.object({ name: publishingChannelNameType.describe("Publishing channel label") }))
    .output(publishingChannelType)
    .handler(async ({ context, input }) => {
      const channel = await Publishing.Channels.create({
        auth: context.auth,
        name: input.name
      });

      emitPublishingEvent(context.auth.workspaceID, {
        action: "publishing:channel-create",
        data: channel,
        memberID: context.auth.session?.memberID
      });

      return channel;
    }),
  deleteChannel: authenticatedRoute
    .route({ method: "DELETE", path: "/channels/:code" })
    .meta({ required: { session: true, key: ["publishing"] } })
    .input(z.object({ code: publishingChannelCodeType.describe("Publishing channel identifier") }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      const { channelID } = await Publishing.Channels.delete({
        auth: context.auth,
        code: input.code
      });
      await enqueuePublishedChannelPurge({
        workspaceID: context.auth.workspaceID,
        channelID
      });

      emitPublishingEvent(context.auth.workspaceID, {
        action: "publishing:channel-delete",
        data: { code: input.code },
        memberID: context.auth.session?.memberID
      });
    })
});

export { publishingRouter };
