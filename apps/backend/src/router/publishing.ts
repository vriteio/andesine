import {
  emitCollectionEvent,
  emitEntryEvent,
  emitPublishingEntryUpdates,
  emitPublishingEvent,
  emitPublishingSnapshotAdvance,
  emitSchemaEvent,
  emitVersionCreationEvents
} from "#backend/events";
import { type CommitPublishingSnapshotResult } from "#backend/lib/publishing";
import {
  enqueueCurrentCollectionSync,
  enqueueCurrentEntrySync,
  enqueuePublishedChannelPurge,
  enqueuePublishedEntrySync
} from "#backend/lib/queue";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Publishing } from "#backend/services/publishing";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";
interface PublishingSnapshotUpdateInput {
  channel: string;
  memberID?: string;
  snapshot: CommitPublishingSnapshotResult | null;
  workspaceID: string;
}
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
const handlers = api.publishing;
const authorizedHandlers = handlers.use(authorized);
const publishingRouter = handlers.router({
  setCollection: authorizedHandlers.setCollection.handler(async ({ context, input }) => {
    const [result] = await Publishing.Collections.set({
      auth: context.auth,
      collectionIDs: [input.collectionID],
      enabled: input.enabled,
      publish: input.publish,
      expectedSnapshots: input.expectedSnapshots,
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
  bulkSetCollections: authorizedHandlers.bulkSetCollections.handler(async ({ context, input }) => {
    const results = await Publishing.Collections.set({
      auth: context.auth,
      collectionIDs: input.ids,
      enabled: input.enabled,
      publish: input.publish,
      expectedSnapshots: input.expectedSnapshots,
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
  publishCollection: authorizedHandlers.publishCollection.handler(async ({ context, input }) => {
    const result = await Publishing.Collections.publish({
      auth: context.auth,
      collectionIDs: [input.collectionID],
      expectedSnapshotID: input.expectedSnapshotID,
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
  bulkPublishCollections: authorizedHandlers.bulkPublishCollections.handler(
    async ({ context, input }) => {
      const result = await Publishing.Collections.publish({
        auth: context.auth,
        collectionIDs: input.ids,
        expectedSnapshotID: input.expectedSnapshotID,
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
    }
  ),
  unpublishCollection: authorizedHandlers.unpublishCollection.handler(
    async ({ context, input }) => {
      const result = await Publishing.Collections.unpublish({
        auth: context.auth,
        collectionIDs: [input.collectionID],
        expectedSnapshotID: input.expectedSnapshotID,
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
    }
  ),
  bulkUnpublishCollections: authorizedHandlers.bulkUnpublishCollections.handler(
    async ({ context, input }) => {
      const result = await Publishing.Collections.unpublish({
        auth: context.auth,
        collectionIDs: input.ids,
        expectedSnapshotID: input.expectedSnapshotID,
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
    }
  ),
  publishEntry: authorizedHandlers.publishEntry.handler(async ({ context, input }) => {
    const result = await Publishing.Entries.publish({
      auth: context.auth,
      entries: [{ entryID: input.entryID, versionID: input.versionID }],
      expectedSnapshotID: input.expectedSnapshotID,
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
  bulkPublishEntries: authorizedHandlers.bulkPublishEntries.handler(async ({ context, input }) => {
    const result = await Publishing.Entries.publish({
      auth: context.auth,
      entries: input.entries,
      expectedSnapshotID: input.expectedSnapshotID,
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
  unpublishEntry: authorizedHandlers.unpublishEntry.handler(async ({ context, input }) => {
    const result = await Publishing.Entries.unpublish({
      auth: context.auth,
      entryIDs: [input.entryID],
      versionID: input.versionID,
      expectedSnapshotID: input.expectedSnapshotID,
      channel: input.channel
    });

    if (input.versionID && !result.removed) {
      throw new ORPCError("CONFLICT", {
        message: "Publishing assignment changed",
        data: {
          hints: [
            "Read publishing.listEntryPublications and review the current version before submitting another unpublish request."
          ]
        }
      });
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
  bulkUnpublishEntries: authorizedHandlers.bulkUnpublishEntries.handler(
    async ({ context, input }) => {
      const result = await Publishing.Entries.unpublish({
        auth: context.auth,
        entryIDs: input.ids,
        expectedSnapshotID: input.expectedSnapshotID,
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
    }
  ),
  revertChanges: authorizedHandlers.revertChanges.handler(async ({ context, input }) => {
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
  getEntryVersion: authorizedHandlers.getEntryVersion.handler(({ context, input }) => {
    return Publishing.Entries.getVersion({
      auth: context.auth,
      entryID: input.entryID,
      expectedSchemaHash: input.expectedSchemaHash,
      channel: input.channel,
      snapshotID: input.snapshotID
    });
  }),
  listEntryPublications: authorizedHandlers.listEntryPublications.handler(({ context, input }) => {
    return Publishing.Entries.listPublications({
      auth: context.auth,
      entryID: input.entryID
    });
  }),
  listChannels: authorizedHandlers.listChannels.handler(({ context, input }) => {
    return Publishing.Channels.list({
      auth: context.auth,
      includeAssignmentCount: input.includeAssignmentCount
    });
  }),
  getChannelContent: authorizedHandlers.getChannelContent.handler(({ context, input }) => {
    return Publishing.Channels.getContent({
      auth: context.auth,
      channel: input.channel,
      collectionID: input.collectionID
    });
  }),
  createChannel: authorizedHandlers.createChannel.handler(async ({ context, input }) => {
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
  deleteChannel: authorizedHandlers.deleteChannel.handler(async ({ context, input }) => {
    const { channelID } = await Publishing.Channels.delete({
      auth: context.auth,
      code: input.code,
      expectedSnapshotID: input.expectedSnapshotID
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
