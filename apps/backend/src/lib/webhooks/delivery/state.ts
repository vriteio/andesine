import { outboundDeliveries, outboundDeliveryRuns } from "#backend/db/outbound-deliveries";
import type { DatabaseTransaction } from "#backend/lib/adapters/postgres";
import { eq } from "drizzle-orm";
import type { LockedDeliveryRun } from "./locking";

type DeliveryStopReason = NonNullable<typeof outboundDeliveryRuns.$inferSelect.stopReason>;

const getDeliveryStopReason = (
  context: LockedDeliveryRun,
  now: Date
): DeliveryStopReason | null => {
  const { endpoint, run, workspaceDeleting } = context;
  const disabled =
    (!endpoint.enabled && run.trigger !== "test") ||
    run.executionGeneration !== endpoint.executionGeneration;

  if (workspaceDeleting || endpoint.deletedAt) return "endpoint_deleted";
  if (run.destinationRevision !== endpoint.destinationRevision) return "destination_changed";
  if (disabled) return "disabled";
  if (run.expiresAt <= now) return "expired";
  if (run.deadlineAt <= now) return "retry_exhausted";

  return null;
};
// Caller holds the ledger locks and has closed any abandoned attempt first.
const stopDeliveryRun = async (
  database: DatabaseTransaction,
  context: LockedDeliveryRun,
  reason: DeliveryStopReason,
  now: Date
): Promise<void> => {
  const state = ["retry_exhausted", "expired", "test_completed"].includes(reason)
    ? "failed"
    : "cancelled";

  await database
    .update(outboundDeliveryRuns)
    .set({
      state,
      stopReason: reason,
      finishedAt: now,
      nextAttemptAt: null,
      leaseToken: null,
      leaseExpiresAt: null,
      workerID: null
    })
    .where(eq(outboundDeliveryRuns.id, context.run.id));
  await database
    .update(outboundDeliveries)
    .set({ state })
    .where(eq(outboundDeliveries.id, context.delivery.id));
};

export { getDeliveryStopReason, stopDeliveryRun };
export type { DeliveryStopReason };
