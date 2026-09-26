import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";
import { id } from "#backend/lib/primitives";
import { publicID } from "#backend/lib/primitives/id";
import * as z from "zod";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [webhookEvent: `${string}:webhooks`]: WebhookEvent;
  }
}

// UI refresh signals only. Payloads carry the endpoint ID, never configuration or secrets.
const webhookEventDataType = z.object({ id: publicID("wh") });
const webhookEventType = z.union([
  z.object({
    action: z.literal("webhook:create"),
    memberID: id().optional(),
    data: webhookEventDataType
  }),
  z.object({
    action: z.literal("webhook:update"),
    memberID: id().optional(),
    data: webhookEventDataType
  }),
  z.object({
    action: z.literal("webhook:delete"),
    memberID: id().optional(),
    data: webhookEventDataType
  })
]);

type WebhookEvent = z.infer<typeof webhookEventType>;

const emitWebhookEvent: EmitEvent<{
  [workspaceID: string]: WebhookEvent;
}> = (workspaceID, event) => {
  emitEvent(`${workspaceID}:webhooks`, event);
};
const subscribeToWebhookEvents: SubscribeToEvent<{
  [workspaceID: string]: WebhookEvent;
}> = (workspaceID, callback, options) => {
  return subscribeToEvent(`${workspaceID}:webhooks`, callback, {
    ...options,
    schema: webhookEventType
  });
};

export { emitWebhookEvent, subscribeToWebhookEvents, webhookEventType };
export type { WebhookEvent };
