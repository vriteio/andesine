import {
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundDeliveryAttempts,
  type Database
} from "@andesine/server/database";
import { and, eq } from "drizzle-orm";
import type { DeliveryLeaseIdentity } from "./claim";
import { lockDeliveryRun, getDeliveryTime } from "./locking";
import { getDeliveryAccessStopReason } from "./access";
import { getDeliveryStopReason, stopDeliveryRun } from "./state";
import { deliveryAttemptResultType, type DeliveryAttemptResult } from "./outcome";
import { getDeliveryRetryTime } from "./retry";
import { recordLateDeliveryResult } from "./late-result";
import { applyDeliveryHealth } from "./health";

interface FinishDeliveryAttemptInput extends DeliveryLeaseIdentity {
  result: DeliveryAttemptResult;
}

type FinishDeliveryAttemptStatus = "applied" | "late" | "stale";

const finishDeliveryAttempt = async (
  database: Database,
  input: FinishDeliveryAttemptInput
): Promise<FinishDeliveryAttemptStatus> => {
  const result = deliveryAttemptResultType.parse(input.result);

  return database.transaction(async (transaction) => {
    // Completion must still record an observed result when the endpoint changed
    // during HTTP. Dispatch's stricter endpoint gate is not a completion gate.
    const context = await lockDeliveryRun(transaction, input, false);

    if (!context) return "stale";

    const [attempt] = await transaction
      .select()
      .from(outboundDeliveryAttempts)
      .where(
        and(
          eq(outboundDeliveryAttempts.workspaceID, context.run.workspaceID),
          eq(outboundDeliveryAttempts.runID, context.run.id),
          eq(outboundDeliveryAttempts.leaseToken, input.leaseToken)
        )
      )
      .for("update");
    const checkedAt = await getDeliveryTime(transaction);

    if (!attempt) return "stale";
    if (
      context.run.state !== "in_flight" ||
      context.run.leaseToken !== input.leaseToken ||
      attempt.outcome !== "in_flight" ||
      attempt.lateResult !== null ||
      !context.run.leaseExpiresAt ||
      context.run.leaseExpiresAt <= checkedAt
    ) {
      return recordLateDeliveryResult(transaction, attempt, result, checkedAt);
    }

    const accessReason =
      getDeliveryStopReason(context, checkedAt) ??
      result.stopReason ??
      (await getDeliveryAccessStopReason(transaction, context));
    const now = await getDeliveryTime(transaction);

    // Permission reads can take time. Recheck the lease after them, before writing.
    if (context.run.leaseExpiresAt <= now) {
      return recordLateDeliveryResult(transaction, attempt, result, now);
    }

    const finishedAt = new Date(Math.max(+now, +attempt.startedAt, +context.run.createdAt));
    const outcome =
      result.outcome === "succeeded" || result.outcome === "unknown" ? result.outcome : "failed";

    await transaction
      .update(outboundDeliveryAttempts)
      .set({
        outcome,
        finishedAt,
        durationMs: result.durationMs,
        httpStatus: result.httpStatus,
        failureCategory: result.failureCategory
      })
      .where(eq(outboundDeliveryAttempts.id, attempt.id));

    const disabled = await applyDeliveryHealth(transaction, context, result, finishedAt);
    const stopReason =
      getDeliveryStopReason(context, now) ?? accessReason ?? (disabled ? "disabled" : null);

    if (stopReason) {
      await stopDeliveryRun(transaction, context, stopReason, finishedAt);
      return "applied";
    }

    if (context.run.trigger === "test" && result.outcome !== "succeeded") {
      await stopDeliveryRun(transaction, context, "test_completed", finishedAt);

      return "applied";
    }

    const nextAttemptAt =
      result.outcome === "succeeded"
        ? null
        : getDeliveryRetryTime({
            attemptNumber: attempt.number,
            now: finishedAt,
            deadlineAt: context.run.deadlineAt,
            retryAfterAt: result.retryAfterAt
          });

    if (result.outcome !== "succeeded" && !nextAttemptAt) {
      await stopDeliveryRun(transaction, context, "retry_exhausted", finishedAt);
      return "applied";
    }

    const state = result.outcome === "succeeded" ? "succeeded" : "pending";

    await transaction
      .update(outboundDeliveryRuns)
      .set({
        state,
        nextAttemptAt,
        finishedAt: state === "succeeded" ? finishedAt : null,
        stopReason: null,
        leaseToken: null,
        leaseExpiresAt: null,
        workerID: null
      })
      .where(eq(outboundDeliveryRuns.id, context.run.id));
    await transaction
      .update(outboundDeliveries)
      .set({ state })
      .where(eq(outboundDeliveries.id, context.delivery.id));

    return "applied";
  });
};

export { finishDeliveryAttempt };
export type { FinishDeliveryAttemptInput, FinishDeliveryAttemptStatus };
