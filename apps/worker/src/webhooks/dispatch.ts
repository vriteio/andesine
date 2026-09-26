import type { db } from "@andesine/backend/lib/adapters/postgres";
import type { SecretEncryption } from "@andesine/backend/lib/security/encryption";
import type { ClaimedDeliveryRun } from "@andesine/backend/lib/webhooks/delivery/claim";
import type { DeliveryAttemptResult } from "@andesine/backend/lib/webhooks/delivery/outcome";
import type { WebhookDestinationConfig } from "@andesine/backend/lib/webhooks/destination-config";
import {
  parseWebhookDestination,
  WebhookDestinationError
} from "@andesine/backend/lib/webhooks/destination";
import {
  loadWebhookHTTPTarget,
  WebhookDispatchUnavailableError
} from "@andesine/backend/lib/webhooks/http-target";
import { signWebhookPayload } from "@andesine/backend/lib/webhooks/signing";
import { sendWebhookRequest } from "./transport";
import { parseRetryAfter } from "./retry-after";

interface DispatchWebhookHTTPInput {
  database: typeof db;
  claim: ClaimedDeliveryRun;
  encryption: SecretEncryption;
  config: WebhookDestinationConfig;
}

const WEBHOOK_REQUEST_TIMEOUT_MS = 15_000;
const dispatchWebhookHTTP = async (
  input: DispatchWebhookHTTPInput
): Promise<DeliveryAttemptResult> => {
  const { database, claim, encryption, config } = input;
  const started = performance.now();
  const controller = new AbortController();
  const signal = controller.signal;
  const empty = { httpStatus: null, retryAfterAt: null, stopReason: null };
  const durationMs = (): number =>
    Math.min(2_147_483_647, Math.max(0, Math.round(performance.now() - started)));
  const abort = (): void => controller.abort();
  const aborted = new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

  let phase: "platform" | "network" = "platform";
  let timer = setTimeout(abort, WEBHOOK_REQUEST_TIMEOUT_MS);

  const constrainDeadline = (remainingMs: number): void => {
    const remaining = Math.min(
      remainingMs,
      WEBHOOK_REQUEST_TIMEOUT_MS - (performance.now() - started)
    );

    clearTimeout(timer);
    if (remaining <= 0) abort();
    else timer = setTimeout(abort, remaining);
    signal.throwIfAborted();
  };
  const send = async (): Promise<DeliveryAttemptResult> => {
    const target = await loadWebhookHTTPTarget(database, claim, signal);
    const destination = parseWebhookDestination(target.url, config);

    constrainDeadline(target.remainingMs);

    const response = await sendWebhookRequest({
      destination,
      payload: claim.payload,
      signal,
      onConnect: () => {
        phase = "network";
      },
      prepareHeaders: async () => {
        phase = "platform";

        // DNS/TLS can take time. Recheck authority, lease, destination and current
        // keys just before signing, after the checked connection is established.
        const current = await loadWebhookHTTPTarget(database, claim, signal);

        constrainDeadline(current.remainingMs);
        if (current.url !== target.url) {
          throw new WebhookDispatchUnavailableError("destination_changed");
        }

        const headers = signWebhookPayload({
          ...claim,
          encryption,
          state: current.secrets,
          now: new Date()
        });

        phase = "network";
        return headers;
      }
    });
    const success = response.status >= 200 && response.status < 300;

    if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
      throw new Error("Invalid HTTP status");
    }

    return {
      ...empty,
      outcome: success ? "succeeded" : "receiver_failure",
      durationMs: durationMs(),
      httpStatus: response.status,
      failureCategory: success ? null : "http_status",
      retryAfterAt: success
        ? null
        : parseRetryAfter(response.retryAfter, new Date(), claim.deadlineAt)
    };
  };

  try {
    return await Promise.race([send(), aborted]);
  } catch (error) {
    if (error instanceof WebhookDestinationError) {
      return {
        ...empty,
        outcome: "platform_failure",
        durationMs: durationMs(),
        failureCategory: "destination_policy",
        stopReason: "destination_policy"
      };
    }

    if (error instanceof WebhookDispatchUnavailableError) {
      return {
        ...empty,
        outcome: "platform_failure",
        durationMs: durationMs(),
        failureCategory: "internal",
        stopReason: error.reason
      };
    }

    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    const infrastructure =
      (phase === "platform" && code !== "WEBHOOK_NO_ADDRESS") ||
      ["ENOMEM", "EMFILE", "ENFILE", "ENOBUFS", "EADDRNOTAVAIL", "EACCES", "EPERM"].includes(
        String(code)
      );

    return {
      ...empty,
      outcome: infrastructure ? "platform_failure" : "receiver_failure",
      durationMs: durationMs(),
      failureCategory: infrastructure ? "internal" : signal.aborted ? "timeout" : "network"
    };
  } finally {
    clearTimeout(timer);
    // Cancels pending DNS/sockets if a platform operation failed before HTTP.
    controller.abort();
  }
};

export { dispatchWebhookHTTP, WEBHOOK_REQUEST_TIMEOUT_MS };
