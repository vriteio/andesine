import { getUserAuthorization } from "#backend/lib/policy";
import { updateDocumentTitle } from "#backend/collaboration";
import {
  emitCollectionEvent,
  emitEntryEvent,
  emitPublishingEntryUpdates,
  emitVersionEvent
} from "#backend/events";
import { toSchemaMigrationID } from "@andesine/contracts/primitives";
import { enqueueCurrentEntrySync, enqueuePublishedEntrySync } from "#backend/lib/queue";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { idempotent } from "#backend/lib/transport/middleware/idempotent";
import { toVersionSummary } from "#backend/lib/versioning/details";
import { Entries } from "#backend/services/entries";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";

const handlers = api.entries;
const authorizedHandlers = handlers.use(authorized).use(idempotent);
const entriesRouter = handlers.router({
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const {
      entry: newEntry,
      createdCollections,
      publishingEntries
    } = await Entries.create({
      ...input,
      auth: context.auth
    });

    for (const collection of createdCollections) {
      emitCollectionEvent(context.auth.workspaceID, {
        action: "collection:create",
        memberID: getUserAuthorization(context.auth)?.memberID,
        data: collection
      });
    }

    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:create",
      memberID: getUserAuthorization(context.auth)?.memberID,
      data: newEntry
    });

    emitPublishingEntryUpdates({
      workspaceID: context.auth.workspaceID,
      entries: publishingEntries,
      memberID: getUserAuthorization(context.auth)?.memberID
    });
    await enqueueCurrentEntrySync({
      workspaceID: context.auth.workspaceID,
      entryIDs: [newEntry.id]
    });

    return newEntry;
  }),
  bulkDelete: authorizedHandlers.bulkDelete.handler(async ({ context, input }) => {
    const { entryIDs } = await Entries.delete({
      auth: context.auth,
      ids: input.ids
    });

    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:delete",
      data: { ids: entryIDs },
      memberID: getUserAuthorization(context.auth)?.memberID
    });
    await Promise.all([
      enqueueCurrentEntrySync({
        workspaceID: context.auth.workspaceID,
        entryIDs
      }),
      enqueuePublishedEntrySync({
        workspaceID: context.auth.workspaceID,
        entryIDs
      })
    ]);
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    const { entryIDs } = await Entries.delete({
      auth: context.auth,
      ids: [input.id]
    });

    if (entryIDs.length === 0) {
      throw new ORPCError("NOT_FOUND");
    }

    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:delete",
      data: { ids: entryIDs }
    });
    await Promise.all([
      enqueueCurrentEntrySync({
        workspaceID: context.auth.workspaceID,
        entryIDs
      }),
      enqueuePublishedEntrySync({
        workspaceID: context.auth.workspaceID,
        entryIDs
      })
    ]);
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    const memberID = getUserAuthorization(context.auth)?.memberID;
    const { createdVersions, hash, version, webhookOperation } = await Entries.update({
      ...input,
      auth: context.auth,
      contributorIDs: memberID ? [memberID] : []
    });

    for (const createdVersion of createdVersions) {
      emitVersionEvent(context.auth.workspaceID, {
        action: "version:create",
        data: toVersionSummary(createdVersion),
        memberID
      });
    }

    if (hash) return { hash, version: version && toVersionSummary(version) };

    const titleHash = await updateDocumentTitle(
      input.id,
      input.name!,
      context.auth.workspaceID,
      memberID,
      webhookOperation
    );

    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:update",
      data: { id: input.id, name: input.name! },
      memberID
    });
    await enqueueCurrentEntrySync({
      workspaceID: context.auth.workspaceID,
      entryIDs: [input.id]
    });

    return { hash: titleHash };
  }),
  bulkUpdate: authorizedHandlers.bulkUpdate.handler(async ({ context, input }) => {
    const memberID = getUserAuthorization(context.auth)?.memberID;
    const { createdVersions, items, error } = await Entries.bulkUpdate({
      auth: context.auth,
      items: input.items,
      contributorIDs: memberID ? [memberID] : []
    });

    for (const createdVersion of createdVersions) {
      emitVersionEvent(context.auth.workspaceID, {
        action: "version:create",
        data: toVersionSummary(createdVersion),
        memberID
      });
    }

    // After the events, as the recovery versions are saved.
    if (error) throw error;

    return {
      items: items.map(({ id, hash, version }) => ({
        id,
        hash,
        version: version && toVersionSummary(version)
      }))
    };
  }),
  move: authorizedHandlers.move.handler(async ({ context, input }) => {
    const result = await Entries.move({
      auth: context.auth,
      id: input.id,
      order: input.order,
      collectionID: input.collectionID,
      collectionPath: input.collectionPath,
      collectionSlugPath: input.collectionSlugPath,
      expectedCollectionID: input.expectedCollectionID,
      confirmedDataLoss: input.confirmedDataLoss
    });
    const targetsCollection = [
      input.collectionID,
      input.collectionPath,
      input.collectionSlugPath
    ].some((value) => value !== undefined);

    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:move",
      data: {
        id: input.id,
        order: result.order,
        collectionID: targetsCollection ? result.collectionID : undefined,
        restrictedBoundaryChanged: result.restrictedBoundaryChanged
      },
      memberID: getUserAuthorization(context.auth)?.memberID
    });

    if (targetsCollection) {
      await Promise.all([
        enqueueCurrentEntrySync({
          workspaceID: context.auth.workspaceID,
          entryIDs: [input.id]
        }),
        enqueuePublishedEntrySync({
          workspaceID: context.auth.workspaceID,
          entryIDs: [input.id]
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
      order: result.order,
      migrationID: result.schemaMigration.migrationID
        ? toSchemaMigrationID(result.schemaMigration.migrationID)
        : null,
      totalEntries: result.schemaMigration.totalEntries
    };
  }),
  bulkMove: authorizedHandlers.bulkMove.handler(async ({ context, input }) => {
    const memberID = getUserAuthorization(context.auth)?.memberID;
    const moves = await Entries.bulkMove({ auth: context.auth, items: input.items });
    const items = moves.map((move, index) => ({
      id: input.items[index].id,
      order: move.order,
      collectionID: move.collectionID
    }));
    const changedIDs = items.filter((_item, index) => moves[index].collectionChanged);
    const publishingEntries = moves.flatMap((move) => move.publishingEntries);

    for (const [index, item] of items.entries()) {
      emitEntryEvent(context.auth.workspaceID, {
        action: "entry:move",
        data: {
          id: item.id,
          order: item.order,
          collectionID: moves[index].collectionChanged ? item.collectionID : undefined,
          restrictedBoundaryChanged: moves[index].restrictedBoundaryChanged
        },
        memberID
      });
    }

    if (changedIDs.length > 0) {
      const entryIDs = changedIDs.map(({ id }) => id);

      await Promise.all([
        enqueueCurrentEntrySync({ workspaceID: context.auth.workspaceID, entryIDs }),
        enqueuePublishedEntrySync({ workspaceID: context.auth.workspaceID, entryIDs })
      ]);
    }

    if (publishingEntries.length > 0) {
      emitPublishingEntryUpdates({
        workspaceID: context.auth.workspaceID,
        entries: publishingEntries,
        memberID
      });
    }

    return { items };
  }),
  get: authorizedHandlers.get.handler(async ({ context, input }) => {
    return Entries.get({
      auth: context.auth,
      id: input.id,
      path: input.path,
      slugPath: input.slugPath,
      expectedSchemaHash: input.expectedSchemaHash,
      format: input.contentFormat
    });
  }),
  list: authorizedHandlers.list.handler(async ({ context, input }) => {
    const { entries, nextCursor } = await Entries.list({
      auth: context.auth,
      collectionID: input.collectionID,
      collectionSlugPath: input.collectionSlugPath,
      collectionPath: input.collectionPath,
      cursor: input.cursor,
      limit: input.limit
    });

    return {
      data: entries,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null
      }
    };
  })
});

export { entriesRouter };
