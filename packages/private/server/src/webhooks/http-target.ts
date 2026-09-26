import { type Database } from "@andesine/server/database";
import { toUUID } from "@andesine/contracts/primitives";
import { type ClaimedDeliveryRun, lockDeliveryLease } from "./delivery/claim";
import { getDeliveryTime } from "./delivery/locking";
import { getDeliveryAccessStopReason } from "./delivery/access";
import type { DeliveryStopReason } from "./delivery/state";
import type { WebhookSecretState } from "./secrets";

interface WebhookHTTPTarget {
  url: string;
  secrets: WebhookSecretState;
  remainingMs: number;
}

class WebhookDispatchUnavailableError extends Error {
  constructor(readonly reason: DeliveryStopReason | null = null) {
    super("Webhook dispatch is no longer available");
    this.name = "WebhookDispatchUnavailableError";
  }
}

const loadWebhookHTTPTarget = async (
  database: Database,
  claim: ClaimedDeliveryRun,
  signal: AbortSignal
): Promise<WebhookHTTPTarget> => {
  signal.throwIfAborted();

  return database.transaction(async (transaction) => {
    const context = await lockDeliveryLease(transaction, claim);

    signal.throwIfAborted();

    if (
      !context ||
      context.endpoint.id !== toUUID(claim.endpointID) ||
      context.delivery.id !== toUUID(claim.deliveryID) ||
      context.delivery.eventID !== toUUID(claim.eventID) ||
      context.run.destinationRevision !== claim.destinationRevision ||
      context.run.executionGeneration !== claim.executionGeneration ||
      !context.delivery.payload.equals(claim.payload)
    ) {
      throw new WebhookDispatchUnavailableError();
    }

    const reason = await getDeliveryAccessStopReason(transaction, context);
    const now = await getDeliveryTime(transaction);
    const remainingMs = Math.min(+context.run.deadlineAt, +context.run.leaseExpiresAt!) - +now;

    signal.throwIfAborted();
    if (reason || remainingMs <= 0) throw new WebhookDispatchUnavailableError(reason);

    return {
      url: context.endpoint.url,
      secrets: {
        currentSecretCiphertext: context.endpoint.currentSecretCiphertext,
        previousSecretCiphertext: context.endpoint.previousSecretCiphertext,
        previousSecretExpiresAt: context.endpoint.previousSecretExpiresAt,
        secretRotatedAt: context.endpoint.secretRotatedAt
      },
      remainingMs
    };
  });
};

export { loadWebhookHTTPTarget, WebhookDispatchUnavailableError };
