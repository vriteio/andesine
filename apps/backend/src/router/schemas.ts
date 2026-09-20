import { emitSchemaEvent, emitSchemaVersionEvent } from "#backend/events";
import { toSchemaVersionSummary } from "#backend/lib/data";
import { toCollectionID, toSchemaID, toSchemaMigrationID } from "#backend/lib/primitives";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Schema } from "#backend/services/schemas";
import { api } from "./implement";

const handlers = api.schemas;
const authorizedHandlers = handlers.use(authorized);
const schemasRouter = handlers.router({
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const result = await Schema.create({
      auth: context.auth,
      collectionID: input.collectionID
    });

    if (result.changed) {
      emitSchemaEvent(context.auth.workspaceID, {
        action: "schema:create",
        memberID: context.auth.session?.memberID,
        data: {
          id: result.schema.id,
          collectionID: result.schema.collectionID,
          enabled: result.schema.enabled,
          hasActiveVersion: Boolean(result.schema.activeVersion),
          hasUnappliedChanges: result.schema.hasUnappliedChanges
        }
      });
    }

    return result.schema;
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    const result = await Schema.delete({
      auth: context.auth,
      schemaID: input.schemaID,
      confirmedDataLoss: input.confirmedDataLoss
    });

    if (!result.migrationID) {
      emitSchemaEvent(context.auth.workspaceID, {
        action: "schema:delete",
        memberID: context.auth.session?.memberID,
        data: {
          id: toSchemaID(result.schemaID),
          collectionID: toCollectionID(result.collectionID),
          enabled: false,
          hasActiveVersion: false,
          hasUnappliedChanges: false
        }
      });
    }

    return {
      migrationID: result.migrationID ? toSchemaMigrationID(result.migrationID) : null,
      affectedCollectionIDs: result.affectedCollectionIDs.map(toCollectionID),
      totalEntries: result.totalEntries
    };
  }),
  getRevision: authorizedHandlers.getRevision.handler(({ context, input }) =>
    Schema.getRevision({ ...input, auth: context.auth })
  ),
  get: authorizedHandlers.get.handler(({ context, input }) => {
    return Schema.get({
      auth: context.auth,
      collectionID: input.collectionID,
      collectionPath: input.collectionPath
    });
  }),
  apply: authorizedHandlers.apply.handler(async ({ context, input }) => {
    const result = await Schema.Migrations.apply({
      auth: context.auth,
      schemaID: input.schemaID,
      confirmedDataLoss: input.confirmedDataLoss,
      name: input.name
    });

    if (result.changed) {
      const version = await Schema.Versions.get({
        auth: context.auth,
        versionID: result.schemaVersionID
      });

      emitSchemaVersionEvent(context.auth.workspaceID, {
        action: "schema-version:create",
        data: toSchemaVersionSummary(version),
        memberID: context.auth.session?.memberID
      });
    }

    return result;
  })
});

export { schemasRouter };
