import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Instance } from "#backend/services/instance";
import { api } from "./implement";

const handlers = api.instance;
const authorizedHandlers = handlers.use(authorized);
const instanceRouter = handlers.router({
  get: authorizedHandlers.get.handler(({ context }) => Instance.get({ auth: context.auth }))
});

export { instanceRouter };
