type WebhookVerificationErrorCode =
  | "INVALID_HEADERS"
  | "INVALID_SIGNATURE"
  | "TIMESTAMP_TOO_OLD"
  | "TIMESTAMP_TOO_NEW"
  | "INVALID_PAYLOAD"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_EVENT"
  | "UNSUPPORTED_SCHEMA"
  | "EVENT_ID_MISMATCH";

const messages: Record<WebhookVerificationErrorCode, string> = {
  INVALID_HEADERS: "Missing or invalid webhook signature headers",
  INVALID_SIGNATURE: "Webhook signature does not match",
  TIMESTAMP_TOO_OLD: "Webhook timestamp is more than five minutes old",
  TIMESTAMP_TOO_NEW: "Webhook timestamp is more than five minutes in the future",
  INVALID_PAYLOAD: "Webhook payload is not a valid event",
  PAYLOAD_TOO_LARGE: "Webhook payload exceeds 256 KiB",
  UNSUPPORTED_EVENT: "Webhook event type is not supported by this SDK version",
  UNSUPPORTED_SCHEMA: "Webhook schema version is not supported by this SDK version",
  EVENT_ID_MISMATCH: "Webhook header and event IDs do not match"
};

class WebhookVerificationError extends Error {
  constructor(readonly code: WebhookVerificationErrorCode) {
    super(messages[code]);
    this.name = "WebhookVerificationError";
  }
}

export { WebhookVerificationError };
export type { WebhookVerificationErrorCode };
