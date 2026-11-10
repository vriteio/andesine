import type { WebhookEvent } from "./generated/schema";
import { webhookEventNames } from "./generated/webhook-event-names";
import { validateWebhookEvent } from "virtual:andesine-webhook-validator";
import { WebhookVerificationError } from "./webhooks/error";
import {
  authenticateWebhook,
  WEBHOOK_MAX_BODY_BYTES,
  type VerifyWebhookInput,
  type WebhookVerificationOptions
} from "./webhooks/signature";

const verifyWebhook = async (input: VerifyWebhookInput): Promise<WebhookEvent> => {
  const { id, body } = await authenticateWebhook(input);

  let value: unknown;

  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(body));
  } catch {
    throw new WebhookVerificationError("INVALID_PAYLOAD");
  }

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("schemaVersion" in value) ||
    !("type" in value)
  ) {
    throw new WebhookVerificationError("INVALID_PAYLOAD");
  }

  if (
    typeof value.schemaVersion !== "number" ||
    !Number.isInteger(value.schemaVersion) ||
    typeof value.type !== "string"
  ) {
    throw new WebhookVerificationError("INVALID_PAYLOAD");
  }

  if (value.schemaVersion !== 1) throw new WebhookVerificationError("UNSUPPORTED_SCHEMA");

  if (!(webhookEventNames as readonly string[]).includes(value.type)) {
    throw new WebhookVerificationError("UNSUPPORTED_EVENT");
  }

  if (!validateWebhookEvent(value)) throw new WebhookVerificationError("INVALID_PAYLOAD");

  const event = value as WebhookEvent;

  if (event.id !== id) throw new WebhookVerificationError("EVENT_ID_MISMATCH");

  return event;
};
/** Consumes the request body once. Configure a body-read deadline in the receiving server. */
const verifyWebhookRequest = async (
  request: Request,
  options: WebhookVerificationOptions
): Promise<WebhookEvent> => {
  if (request.bodyUsed) throw new TypeError("Webhook request body was already consumed");

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];

  let size = 0;

  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        size += value.byteLength;

        if (size > WEBHOOK_MAX_BODY_BYTES) {
          await reader.cancel().catch(() => {});
          throw new WebhookVerificationError("PAYLOAD_TOO_LARGE");
        }

        chunks.push(new Uint8Array(value));
      }
    } finally {
      reader.releaseLock();
    }
  }

  const body = new Uint8Array(size);

  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return verifyWebhook({ ...options, body, headers: request.headers });
};

export { verifyWebhook, verifyWebhookRequest, WebhookVerificationError };
export type { VerifyWebhookInput, WebhookVerificationOptions };
export type { WebhookVerificationErrorCode } from "./webhooks/error";
export type { WebhookEvent, WebhookEventName } from "./generated/schema";
