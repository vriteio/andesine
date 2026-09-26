import { generateUUID } from "../primitives/id";
import {
  publicID,
  toUUID,
  toWebhookEventID,
  toWebhookOperationID
} from "@andesine/contracts/primitives";
import { createHash } from "node:crypto";
import { webhookEventType, type WebhookEvent } from "@andesine/contracts/webhooks";

interface WebhookOperation {
  id: string;
  workspaceID: string;
}

type WebhookEventData = {
  [Event in WebhookEvent as Event["type"]]: Pick<Event, "type" | "subject" | "data">;
}[WebhookEvent["type"]];

const createWebhookOperation = (
  workspaceID: string,
  id = toWebhookOperationID(generateUUID())
): WebhookOperation => ({
  id: publicID("whop").parse(id),
  workspaceID: publicID("ws").parse(workspaceID)
});
// Reuse the operation ID and semantic item key when retrying a transaction/job item.
// A second change to the same resource within that operation needs a different key.
const createOutboundEvent = (
  operation: WebhookOperation,
  key: string,
  data: WebhookEventData,
  occurredAt = new Date()
): WebhookEvent => {
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

  return webhookEventType.parse({
    ...data,
    id: toWebhookEventID(uuid),
    operationID: operation.id,
    workspaceID: operation.workspaceID,
    schemaVersion: 1,
    occurredAt: occurredAt.toISOString(),
    test: false
  });
};

export { createWebhookOperation, createOutboundEvent };
export type { WebhookOperation, WebhookEventData };
