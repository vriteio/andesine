import { emitSchemaEvent, emitSchemaVersionEvent } from "#backend/events";
import { toSchemaVersionSummary } from "#backend/lib/data";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Schema } from "#backend/services/schemas";
import { api } from "./implement";

const handlers = api.schemaVersions;
const authorizedHandlers = handlers.use(authorized);
const schemaVersionsRouter = handlers.router({
  list: authorizedHandlers.list.handler(async ({ context, input }) => {
    const { versions, nextCursor } = await Schema.Versions.list({
      auth: context.auth,
      schemaID: input.schemaID,
      cursor: input.cursor,
      limit: input.limit
    });

    return {
      data: versions,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null
      }
    };
  }),
  get: authorizedHandlers.get.handler(({ context, input }) => {
    return Schema.Versions.get({
      auth: context.auth,
      versionID: input.id
    });
  }),
  revert: authorizedHandlers.revert.handler(async ({ context, input }) => {
    const result = await Schema.Versions.revert({
      auth: context.auth,
      versionID: input.id,
      confirmedDataLoss: input.confirmedDataLoss,
      name: input.name
    });
    for (const versionID of result.createdVersionIDs) {
      const version = await Schema.Versions.get({
        auth: context.auth,
        versionID
      });

      emitSchemaVersionEvent(context.auth.workspaceID, {
        action: "schema-version:create",
        data: toSchemaVersionSummary(version),
        memberID: context.auth.session?.memberID
      });
    }
    emitSchemaEvent(context.auth.workspaceID, {
      action: "schema:update",
      data: {
        id: result.schemaID,
        collectionID: result.collectionID,
        enabled: true,
        hasActiveVersion: true,
        hasUnappliedChanges: Boolean(result.application.migrationID)
      },
      memberID: context.auth.session?.memberID
    });
    emitSchemaEvent(context.auth.workspaceID, {
      action: "schema:content-reset",
      data: {
        id: result.schemaID,
        collectionID: result.collectionID,
        enabled: true,
        hasActiveVersion: true,
        hasUnappliedChanges: Boolean(result.application.migrationID)
      }
    });

    return result.application;
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    const version = await Schema.Versions.update({
      auth: context.auth,
      versionID: input.id,
      name: input.name
    });

    emitSchemaVersionEvent(context.auth.workspaceID, {
      action: "schema-version:update",
      data: toSchemaVersionSummary(version),
      memberID: context.auth.session?.memberID
    });
  })
});

export { schemaVersionsRouter };
