import { emitWebhookEvent } from "#backend/events";
import type { SessionData } from "#backend/lib/policy";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { WebhooksService } from "#backend/services/webhooks";
import { api } from "./implement";

const handlers = api.webhooks;
const authorizedHandlers = handlers.use(authorized).use(async ({ context, next }) => {
  context.resHeaders?.set("Cache-Control", "private, no-store");
  return next();
});
const emitChange = (
  auth: SessionData,
  action: "webhook:create" | "webhook:update" | "webhook:delete",
  id: string
) => {
  emitWebhookEvent(auth.workspaceID, { action, memberID: auth.session?.memberID, data: { id } });
};
const webhooksRouter = handlers.router({
  sendTest: authorizedHandlers.sendTest.handler(async ({ context, input }) => {
    const result = await WebhooksService.sendTest({ ...input, auth: context.auth });

    emitChange(context.auth, "webhook:update", input.id);

    return result;
  }),
  listDeliveries: authorizedHandlers.listDeliveries.handler(({ context, input }) =>
    WebhooksService.listDeliveries({ ...input, auth: context.auth })
  ),
  getDelivery: authorizedHandlers.getDelivery.handler(({ context, input }) =>
    WebhooksService.getDelivery({ ...input, auth: context.auth })
  ),
  listRuns: authorizedHandlers.listRuns.handler(({ context, input }) =>
    WebhooksService.listRuns({ ...input, auth: context.auth })
  ),
  listAttempts: authorizedHandlers.listAttempts.handler(({ context, input }) =>
    WebhooksService.listAttempts({ ...input, auth: context.auth })
  ),
  redeliver: authorizedHandlers.redeliver.handler(async ({ context, input }) => {
    const result = await WebhooksService.redeliver({ ...input, auth: context.auth });

    emitChange(context.auth, "webhook:update", input.id);

    return result;
  }),
  bulkRedeliver: authorizedHandlers.bulkRedeliver.handler(async ({ context, input }) => {
    const data = await WebhooksService.bulkRedeliver({ ...input, auth: context.auth });

    emitChange(context.auth, "webhook:update", input.id);

    return { data };
  }),

  list: authorizedHandlers.list.handler(({ context, input }) =>
    WebhooksService.list({ ...input, auth: context.auth })
  ),
  get: authorizedHandlers.get.handler(({ context, input }) =>
    WebhooksService.get({ ...input, auth: context.auth })
  ),
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const result = await WebhooksService.create({ ...input, auth: context.auth });

    emitChange(context.auth, "webhook:create", result.endpoint.id);

    return result;
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    const result = await WebhooksService.update({ ...input, auth: context.auth });

    emitChange(context.auth, "webhook:update", input.id);

    return result;
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    await WebhooksService.delete({ ...input, auth: context.auth });

    emitChange(context.auth, "webhook:delete", input.id);
  }),
  bulkSetEnabled: authorizedHandlers.bulkSetEnabled.handler(async ({ context, input }) => {
    const data = await WebhooksService.bulkSetEnabled({ ...input, auth: context.auth });

    for (const { id } of input.webhooks) {
      emitChange(context.auth, "webhook:update", id);
    }

    return { data };
  }),
  bulkDelete: authorizedHandlers.bulkDelete.handler(async ({ context, input }) => {
    await WebhooksService.bulkDelete({ ...input, auth: context.auth });

    for (const { id } of input.webhooks) {
      emitChange(context.auth, "webhook:delete", id);
    }
  }),
  rotateSecret: authorizedHandlers.rotateSecret.handler(async ({ context, input }) => {
    const result = await WebhooksService.rotateSecret({ ...input, auth: context.auth });

    emitChange(context.auth, "webhook:update", input.id);

    return result;
  })
});

export { webhooksRouter };
