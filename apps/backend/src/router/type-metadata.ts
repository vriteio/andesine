import { authorized } from "#backend/lib/transport";
import { TypeMetadata } from "#backend/services/type-metadata";
import { api } from "./implement";

const handlers = api.typeMetadata;
const authorizedHandlers = handlers.use(authorized);
const typeMetadataRouter = handlers.router({
  getCurrent: authorizedHandlers.getCurrent.handler(({ context, input }) => {
    context.resHeaders?.set("Cache-Control", "private, no-store");
    return TypeMetadata.getCurrent({ ...input, auth: context.auth });
  }),
  getPublished: authorizedHandlers.getPublished.handler(({ context, input }) => {
    context.resHeaders?.set("Cache-Control", "private, no-store");
    return TypeMetadata.getPublished({ ...input, auth: context.auth });
  })
});

export { typeMetadataRouter };
