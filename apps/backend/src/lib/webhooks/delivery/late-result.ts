import { outboundDeliveryAttempts } from "#backend/db/outbound-deliveries";
import type { DatabaseTransaction } from "#backend/lib/adapters/postgres";
import { and, eq, isNull } from "drizzle-orm";
import type { DeliveryAttemptResult } from "./outcome";

// Caller holds the workspace/endpoint/run/delivery/attempt locks. This is audit
// evidence only: it cannot complete a run, reschedule work, or change endpoint health.
const recordLateDeliveryResult = async (
  database: DatabaseTransaction,
  attempt: typeof outboundDeliveryAttempts.$inferSelect,
  result: DeliveryAttemptResult,
  now: Date
): Promise<"late" | "stale"> => {
  if (
    result.outcome === "unknown" ||
    attempt.lateResult ||
    (attempt.outcome !== "unknown" && attempt.outcome !== "in_flight")
  ) {
    return "stale";
  }

  await database
    .update(outboundDeliveryAttempts)
    .set({
      lateResult: {
        receivedAt: now.toISOString(),
        outcome: result.outcome,
        durationMs: result.durationMs,
        httpStatus: result.httpStatus,
        failureCategory: result.failureCategory
      }
    })
    .where(
      and(eq(outboundDeliveryAttempts.id, attempt.id), isNull(outboundDeliveryAttempts.lateResult))
    );

  return "late";
};

export { recordLateDeliveryResult };
