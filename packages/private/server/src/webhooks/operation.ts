import { generateUUID } from "../primitives/id";
import {
  publicID,
  toUUID,
  toWebhookEventID,
  toWebhookOperationID
} from "@andesine/contracts/primitives";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import {
  outboundEventType,
  type OutboundEvent,
  type WebhookActor
} from "@andesine/contracts/webhooks";

interface WebhookOperation {
  id: string;
  workspaceID: string;
  /** Who made the change, sent in event envelopes; an extension's webhooks skip its own. */
  actor: WebhookActor | null;
}

type WebhookEventData = {
  [Event in OutboundEvent as Event["type"]]: Pick<Event, "type" | "subject" | "data">;
}[OutboundEvent["type"]];

// Set by the backend for each service call from the verified principal, never from input.
const webhookActorStorage = new AsyncLocalStorage<WebhookActor | null>();
const runWithWebhookActor = <T>(actor: WebhookActor | null, run: () => T): T => {
  return webhookActorStorage.run(actor, run);
};
const getWebhookActor = (): WebhookActor | null => webhookActorStorage.getStore() ?? null;
const createWebhookOperation = (
  workspaceID: string,
  id = toWebhookOperationID(generateUUID()),
  actor = getWebhookActor()
): WebhookOperation => ({
  id: publicID("whop").parse(id),
  workspaceID: publicID("ws").parse(workspaceID),
  actor
});
// Reuse the operation ID and semantic item key when retrying a transaction/job item.
// A second change to the same resource within that operation needs a different key.
const createOutboundEvent = (
  operation: WebhookOperation,
  key: string,
  data: WebhookEventData,
  occurredAt = new Date()
): OutboundEvent => {
  const identity = JSON.stringify([
    toUUID(operation.workspaceID),
    toUUID(operation.id),
    key,
    data.type,
    data.subject.kind === "channel" ? data.subject.code : toUUID(data.subject.id)
  ]);
  const bytes = createHash("sha256").update(identity).digest().subarray(0, 16);

  if (!key) throw new Error("A webhook event requires a stable item key");

  // UUIDv8: application-defined deterministic identity, with the standard variant.
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

  return outboundEventType.parse({
    ...data,
    id: toWebhookEventID(uuid),
    operationID: operation.id,
    workspaceID: operation.workspaceID,
    actor: operation.actor,
    schemaVersion: 1,
    occurredAt: occurredAt.toISOString(),
    test: false
  });
};

export { createWebhookOperation, createOutboundEvent, getWebhookActor, runWithWebhookActor };
export type { WebhookOperation, WebhookEventData };
