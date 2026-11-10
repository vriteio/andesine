import { webhookEventType, type WebhookEvent } from "@andesine/contracts/events";
import {
  emitEvent,
  type EmitEvent,
  subscribeToEvent,
  type SubscribeToEvent
} from "#backend/lib/messaging";

declare module "#backend/lib/messaging/events" {
  interface Events {
    [webhookEvent: `${string}:webhooks`]: WebhookEvent;
  }
}

// UI refresh signals only. Payloads carry the endpoint ID, never configuration or secrets.

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

export { emitWebhookEvent, subscribeToWebhookEvents };
