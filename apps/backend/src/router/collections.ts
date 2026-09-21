import { getUserAuthorization } from "#backend/lib/policy";
import {
  emitCollectionEvent,
  emitEntryEvent,
  emitGroupEvent,
  emitPublishingEntryUpdates,
  emitPublishingEvent
} from "#backend/events";
import { toSchemaMigrationID } from "#backend/lib/primitives";
import {
  enqueueCurrentCollectionSync,
  enqueueCurrentEntrySync,
  enqueuePublishedCollectionSync,
  enqueuePublishedEntrySync
} from "#backend/lib/queue";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Collections } from "#backend/services/collections";
import { api } from "./implement";

const handlers = api.collections;
const authorizedHandlers = handlers.use(authorized);
const collectionsRouter = handlers.router({
  listRestrictedAssignments: authorizedHandlers.listRestrictedAssignments.handler(
    ({ context, input }) => {
      return Collections.listRestrictedAssignments({
        auth: context.auth,
        collectionID: input.id
      });
    }
  ),
  setRestrictedAssignments: authorizedHandlers.setRestrictedAssignments.handler(
    async ({ context, input }) => {
      const { affectedUserIDs } = await Collections.setRestrictedAssignments({
        auth: context.auth,
        collectionID: input.id,
        groups: input.groups,
        members: input.members
      });

      emitGroupEvent(context.auth.workspaceID, {
        action: "restricted-assignments:update",
        affectedUserIDs,
        memberID: getUserAuthorization(context.auth)?.memberID,
        data: { collectionID: input.id }
      });
    }
  ),
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const newCollection = await Collections.create({
      ...input,
      auth: context.auth
    });

    emitCollectionEvent(context.auth.workspaceID, {
      action: "collection:create",
      memberID: getUserAuthorization(context.auth)?.memberID,
      data: newCollection
    });

    return newCollection;
  }),
  bulkDelete: authorizedHandlers.bulkDelete.handler(async ({ context, input }) => {
    const deleted = await Collections.delete({
      auth: context.auth,
      ids: input.ids
    });

    emitCollectionEvent(context.auth.workspaceID, {
      action: "collection:delete",
      data: { ids: deleted.collectionIDs },
      memberID: getUserAuthorization(context.auth)?.memberID
    });

    for (const collectionID of deleted.collectionIDs) {
      emitPublishingEvent(context.auth.workspaceID, {
        action: "publishing:collection-update",
        data: { id: collectionID, enabled: false },
        memberID: getUserAuthorization(context.auth)?.memberID
      });
    }

    if (deleted.entryIDs.length > 0) {
      emitEntryEvent(context.auth.workspaceID, {
        action: "entry:delete",
        data: { ids: deleted.entryIDs },
        memberID: getUserAuthorization(context.auth)?.memberID
      });
      await Promise.all([
        enqueueCurrentEntrySync({
          workspaceID: context.auth.workspaceID,
          entryIDs: deleted.entryIDs
        }),
        enqueuePublishedEntrySync({
          workspaceID: context.auth.workspaceID,
          entryIDs: deleted.entryIDs
        })
      ]);
    }
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    const deleted = await Collections.delete({
      auth: context.auth,
      ids: [input.id]
    });

    emitCollectionEvent(context.auth.workspaceID, {
      action: "collection:delete",
      data: { ids: deleted.collectionIDs },
      memberID: getUserAuthorization(context.auth)?.memberID
    });

    for (const collectionID of deleted.collectionIDs) {
      emitPublishingEvent(context.auth.workspaceID, {
        action: "publishing:collection-update",
        data: { id: collectionID, enabled: false },
        memberID: getUserAuthorization(context.auth)?.memberID
      });
    }

    if (deleted.entryIDs.length > 0) {
      emitEntryEvent(context.auth.workspaceID, {
        action: "entry:delete",
        data: { ids: deleted.entryIDs },
        memberID: getUserAuthorization(context.auth)?.memberID
      });
      await Promise.all([
        enqueueCurrentEntrySync({
          workspaceID: context.auth.workspaceID,
          entryIDs: deleted.entryIDs
        }),
        enqueuePublishedEntrySync({
          workspaceID: context.auth.workspaceID,
          entryIDs: deleted.entryIDs
        })
      ]);
    }
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    await Collections.update({
      auth: context.auth,
      id: input.id,
      name: input.name
    });

    emitCollectionEvent(context.auth.workspaceID, {
      action: "collection:update",
      data: { id: input.id, name: input.name },
      memberID: getUserAuthorization(context.auth)?.memberID
    });

    if (input.name !== undefined) {
      await Promise.all([
        enqueueCurrentCollectionSync({
          workspaceID: context.auth.workspaceID,
          collectionID: input.id
        }),
        enqueuePublishedCollectionSync({
          workspaceID: context.auth.workspaceID,
          collectionID: input.id
        })
      ]);
    }
  }),
  setRestricted: authorizedHandlers.setRestricted.handler(async ({ context, input }) => {
    await Collections.setRestricted({
      auth: context.auth,
      id: input.id,
      restricted: input.restricted
    });

    emitCollectionEvent(context.auth.workspaceID, {
      action: "collection:update",
      data: { id: input.id, restricted: input.restricted },
      memberID: getUserAuthorization(context.auth)?.memberID
    });
    await enqueueCurrentCollectionSync({
      workspaceID: context.auth.workspaceID,
      collectionID: input.id
    });
  }),
  move: authorizedHandlers.move.handler(async ({ context, input }) => {
    const result = await Collections.move({
      auth: context.auth,
      id: input.id,
      newParentID: input.newParentID,
      index: input.index,
      confirmedDataLoss: input.confirmedDataLoss
    });

    emitCollectionEvent(context.auth.workspaceID, {
      action: "collection:move",
      data: {
        id: input.id,
        newParentID: result.newParentID,
        index: result.index,
        restrictedBoundaryChanged: result.restrictedBoundaryChanged
      },
      memberID: getUserAuthorization(context.auth)?.memberID
    });

    if (input.newParentID !== undefined) {
      await Promise.all([
        enqueueCurrentCollectionSync({
          workspaceID: context.auth.workspaceID,
          collectionID: input.id
        }),
        enqueuePublishedCollectionSync({
          workspaceID: context.auth.workspaceID,
          collectionID: input.id
        })
      ]);
    }

    if (result.publishingEntries.length > 0) {
      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: result.publishingEntries,
        memberID: getUserAuthorization(context.auth)?.memberID
      });
    }

    return {
      migrationID: result.schemaMigration.migrationID
        ? toSchemaMigrationID(result.schemaMigration.migrationID)
        : null,
      totalEntries: result.schemaMigration.totalEntries
    };
  }),
  list: authorizedHandlers.list.handler(async ({ context, input }) => {
    const { collections, nextCursor } = await Collections.list({
      auth: context.auth,
      collectionID: input.collectionID,
      collectionPath: input.collectionPath,
      cursor: input.cursor,
      limit: input.limit
    });

    return {
      data: collections,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null
      }
    };
  })
});

export { collectionsRouter };
