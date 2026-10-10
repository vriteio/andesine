import { generateUUID } from "../primitives/id";
import {
  publicID,
  toUUID,
  toWebhookEventID,
  toWebhookOperationID
} from "@andesine/contracts/primitives";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { outboundEventType, type OutboundEvent } from "@andesine/contracts/webhooks";

interface WebhookOperation {
  id: string;
  workspaceID: string;
  /** The extension whose JWT made the change (`ext_` ID); its webhooks do not receive it. */
  originExtensionID: string | null;
}

type WebhookEventData = {
  [Event in OutboundEvent as Event["type"]]: Pick<Event, "type" | "subject" | "data">;
}[OutboundEvent["type"]];

// Set by the backend for each service call from the verified principal, never from input.
const webhookOriginStorage = new AsyncLocalStorage<string | null>();
const runWithWebhookOrigin = <T>(originExtensionID: string | null, run: () => T): T => {
  return webhookOriginStorage.run(originExtensionID, run);
};
const getWebhookOrigin = (): string | null => webhookOriginStorage.getStore() ?? null;
/** The origin's UUID, for records that carry it to later jobs. */
const getWebhookOriginUUID = (): string | null => {
  const origin = getWebhookOrigin();

  return origin && toUUID(origin);
};
const createWebhookOperation = (
  workspaceID: string,
  id = toWebhookOperationID(generateUUID()),
  originExtensionID = getWebhookOrigin()
): WebhookOperation => ({
  id: publicID("whop").parse(id),
  workspaceID: publicID("ws").parse(workspaceID),
  originExtensionID: originExtensionID && publicID("ext").parse(originExtensionID)
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
    schemaVersion: 1,
    occurredAt: occurredAt.toISOString(),
    test: false
  });
};

export {
  createWebhookOperation,
  createOutboundEvent,
  getWebhookOrigin,
  getWebhookOriginUUID,
  runWithWebhookOrigin
};
export type { WebhookOperation, WebhookEventData };
