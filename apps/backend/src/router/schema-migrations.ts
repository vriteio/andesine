import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Schema } from "#backend/services/schemas";
import { api } from "./implement";

const handlers = api.schemaMigrations;
const authorizedHandlers = handlers.use(authorized);
const schemaMigrationsRouter = handlers.router({
  listContentLossEntries: authorizedHandlers.listContentLossEntries.handler(({ context, input }) =>
    Schema.Migrations.listContentLossEntries({
      auth: context.auth,
      migrationID: input.id,
      cursor: input.cursor,
      limit: input.limit
    })
  ),
  getActive: authorizedHandlers.getActive.handler(({ context, input }) => {
    return Schema.Migrations.getActive({
      auth: context.auth,
      collectionID: input.collectionID
    });
  }),
  get: authorizedHandlers.get.handler(({ context, input }) => {
    return Schema.Migrations.get({
      auth: context.auth,
      migrationID: input.id
    });
  })
});

export { schemaMigrationsRouter };
