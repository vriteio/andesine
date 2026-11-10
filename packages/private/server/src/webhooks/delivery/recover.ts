import { outboundDeliveries, outboundDeliveryRuns, type Database } from "@andesine/server/database";
import { eq } from "drizzle-orm";
import { getDeliveryAccessStopReason } from "./access";
import { lockDeliveryRun, getDeliveryTime, type DeliveryRunIdentity } from "./locking";
import { getDeliveryStopReason, stopDeliveryRun } from "./state";
import { getDeliveryRetryTime } from "./retry";
import { abandonDeliveryAttempt } from "./abandon";

// No receiver failure is inferred from a lost worker. Keep the original payload,
// deadline, and expiry, and let PostgreSQL schedule the next wake-up.
const recoverDeliveryRun = async (
  database: Database,
  input: DeliveryRunIdentity
): Promise<boolean> => {
  return database.transaction(async (transaction) => {
    const context = await lockDeliveryRun(transaction, input);

    if (!context || !["pending", "in_flight"].includes(context.run.state)) return false;

    const now = await getDeliveryTime(transaction);
    const abandoned =
      context.run.state === "in_flight" &&
      (context.run.leaseExpiresAt! <= now || context.run.deadlineAt <= now);

    let attemptNumber = 0;

    if (context.run.state === "in_flight" && !abandoned) return false;

    if (abandoned) {
      attemptNumber = await abandonDeliveryAttempt(transaction, context, now);
    }

    const reason =
      getDeliveryStopReason(context, now) ??
      (await getDeliveryAccessStopReason(transaction, context));

    if (reason) {
      await stopDeliveryRun(transaction, context, reason, now);
      return true;
    }

    if (!abandoned) return false;

    if (context.run.trigger === "test") {
      await stopDeliveryRun(transaction, context, "test_completed", now);

      return true;
    }

    const retryAt = await getDeliveryTime(transaction);
    const currentReason = getDeliveryStopReason(context, retryAt);
    const nextAttemptAt = currentReason
      ? null
      : getDeliveryRetryTime({
          attemptNumber,
          now: retryAt,
          deadlineAt: context.run.deadlineAt,
          retryAfterAt: null
        });

    if (!nextAttemptAt) {
      await stopDeliveryRun(transaction, context, currentReason ?? "retry_exhausted", retryAt);
      return true;
    }

    await transaction
      .update(outboundDeliveryRuns)
      .set({
        state: "pending",
        nextAttemptAt,
        leaseToken: null,
        leaseExpiresAt: null,
        workerID: null
      })
      .where(eq(outboundDeliveryRuns.id, context.run.id));
    await transaction
      .update(outboundDeliveries)
      .set({ state: "pending" })
      .where(eq(outboundDeliveries.id, context.delivery.id));

    return true;
  });
};

export { recoverDeliveryRun };
