import { updateDocumentTitle } from "#backend/collaboration";
import { emitEntryEvent, emitPublishingEntryUpdates } from "#backend/events";
import { toSchemaMigrationID } from "#backend/lib/primitives";
import { enqueueCurrentEntrySync, enqueuePublishedEntrySync } from "#backend/lib/queue";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Entries } from "#backend/services/entries";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";

const handlers = api.entries;
const authorizedHandlers = handlers.use(authorized);
const entriesRouter = handlers.router({
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const { entry: newEntry, publishingEntries } = await Entries.create({
      ...input,
      auth: context.auth
    });

    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:create",
      memberID: context.auth.session?.memberID,
      data: newEntry
    });

    emitPublishingEntryUpdates({
      workspaceID: context.auth.workspaceID,
      entries: publishingEntries,
      memberID: context.auth.session?.memberID
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
      memberID: context.auth.session?.memberID
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
    const name = input.name;

    await Entries.update({
      auth: context.auth,
      id: input.id,
      name
    });

    if (name !== undefined) {
      await updateDocumentTitle(
        input.id,
        name,
        context.auth.workspaceID,
        context.auth.session?.memberID
      );
    }

    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:update",
      data: { id: input.id, name },
      memberID: context.auth.session?.memberID
    });

    if (name !== undefined) {
      await enqueueCurrentEntrySync({
        workspaceID: context.auth.workspaceID,
        entryIDs: [input.id]
      });
    }
  }),
  move: authorizedHandlers.move.handler(async ({ context, input }) => {
    const result = await Entries.move({
      auth: context.auth,
      id: input.id,
      order: input.order,
      collectionID: input.collectionID,
      confirmedDataLoss: input.confirmedDataLoss
    });
    emitEntryEvent(context.auth.workspaceID, {
      action: "entry:move",
      data: {
        id: input.id,
        order: result.order,
        collectionID: input.collectionID,
        restrictedBoundaryChanged: result.restrictedBoundaryChanged
      },
      memberID: context.auth.session?.memberID
    });

    if (input.collectionID !== undefined) {
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
        memberID: context.auth.session?.memberID
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
  get: authorizedHandlers.get.handler(async ({ context, input }) => {
    return Entries.get({
      auth: context.auth,
      id: input.id,
      path: input.path,
      expectedSchemaHash: input.expectedSchemaHash
    });
  }),
  list: authorizedHandlers.list.handler(async ({ context, input }) => {
    const { entries, nextCursor } = await Entries.list({
      auth: context.auth,
      collectionID: input.collectionID,
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
