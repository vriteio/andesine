import { webhookEndpoints, webhookEndpointRevisions } from "#backend/db/webhooks";
import type { DatabaseTransaction } from "#backend/lib/adapters/postgres";
import { getWebhookConfiguration } from "../endpoints";
import { eq } from "drizzle-orm";
import type { LockedDeliveryRun } from "./locking";
import type { DeliveryAttemptResult } from "./outcome";

const WEBHOOK_FAILURE_THRESHOLD = 10;
const WEBHOOK_FAILURE_PERIOD_MS = 72 * 60 * 60 * 1000;
// Caller holds workspace -> endpoint locks. Selection and claims stop immediately;
// remaining runs are cancelled in bounded maintenance batches after this commit.
const disableFailedWebhook = async (
  database: DatabaseTransaction,
  endpoint: typeof webhookEndpoints.$inferSelect,
  now: Date
): Promise<boolean> => {
  const eligible =
    endpoint.enabled &&
    !endpoint.deletedAt &&
    endpoint.consecutiveFailures >= WEBHOOK_FAILURE_THRESHOLD &&
    endpoint.firstFailureAt &&
    +endpoint.firstFailureAt + WEBHOOK_FAILURE_PERIOD_MS <= +now;

  if (!eligible) return false;

  const revision = endpoint.revision + 1;

  await database.insert(webhookEndpointRevisions).values({
    workspaceID: endpoint.workspaceID,
    endpointID: endpoint.id,
    revision,
    destinationRevision: endpoint.destinationRevision,
    configuration: { ...getWebhookConfiguration(endpoint), enabled: false },
    createdAt: now
  });
  await database
    .update(webhookEndpoints)
    .set({
      enabled: false,
      disabledReason: "failures",
      executionGeneration: endpoint.executionGeneration + 1,
      revision,
      updatedAt: now
    })
    .where(eq(webhookEndpoints.id, endpoint.id));

  return true;
};

// This runs in the completion transaction, once per current, unexpired attempt.
const applyDeliveryHealth = async (
  database: DatabaseTransaction,
  context: LockedDeliveryRun,
  result: DeliveryAttemptResult,
  now: Date
): Promise<boolean> => {
  const { endpoint, run, workspaceDeleting } = context;
  const current =
    !workspaceDeleting &&
    (endpoint.enabled || run.trigger === "test") &&
    !endpoint.deletedAt &&
    run.destinationRevision === endpoint.destinationRevision &&
    run.executionGeneration === endpoint.executionGeneration;

  if (!current || (result.outcome !== "succeeded" && result.outcome !== "receiver_failure")) {
    return false;
  }

  const change =
    result.outcome === "succeeded"
      ? {
          consecutiveFailures: 0,
          firstFailureAt: null,
          lastFailureAt: null,
          lastFailureCategory: null,
          lastSuccessAt: now
        }
      : {
          consecutiveFailures: Math.min(2_147_483_647, endpoint.consecutiveFailures + 1),
          firstFailureAt: endpoint.firstFailureAt ?? now,
          lastFailureAt: now,
          lastFailureCategory: result.failureCategory
        };
  const [updated] = await database
    .update(webhookEndpoints)
    .set({ ...change, updatedAt: now })
    .where(eq(webhookEndpoints.id, endpoint.id))
    .returning();

  return disableFailedWebhook(database, updated!, now);
};

export {
  applyDeliveryHealth,
  disableFailedWebhook,
  WEBHOOK_FAILURE_THRESHOLD,
  WEBHOOK_FAILURE_PERIOD_MS
};
