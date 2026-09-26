import { createHmac } from "node:crypto";
import { publicID } from "@andesine/contracts/primitives";
import { getWebhookSigningKeys, type ReadWebhookSecretsInput } from "./secrets";

interface SignWebhookPayloadInput extends ReadWebhookSecretsInput {
  eventID: string;
  payload: Uint8Array;
}
interface WebhookSignatureHeaders {
  "content-type": "application/json";
  "webhook-id": string;
  "webhook-timestamp": string;
  "webhook-signature": string;
}

const eventIDType = publicID("whevt");
// Standard Webhooks v1: UTF-8 id.timestamp. followed by the exact stored bytes.
// Caller sends the same payload and uses a fresh time for every attempt.
const signWebhookPayload = (input: SignWebhookPayloadInput): WebhookSignatureHeaders => {
  const eventID = eventIDType.parse(input.eventID);
  const keys = getWebhookSigningKeys(input);
  const timestamp = Math.floor(input.now.getTime() / 1000).toString();

  try {
    const signatures = keys.map((key) => {
      const digest = createHmac("sha256", key)
        .update(`${eventID}.${timestamp}.`, "utf8")
        .update(input.payload)
        .digest("base64");

      return `v1,${digest}`;
    });

    return {
      "content-type": "application/json",
      "webhook-id": eventID,
      "webhook-timestamp": timestamp,
      "webhook-signature": signatures.join(" ")
    };
  } finally {
    keys.forEach((key) => key.fill(0));
  }
};

export { signWebhookPayload };
export type { WebhookSignatureHeaders };
