import { outboundDeliveryAttempts } from "#backend/db/outbound-deliveries";
import type { DatabaseTransaction } from "#backend/lib/adapters/postgres";
import { and, eq, sql } from "drizzle-orm";
import type { LockedDeliveryRun } from "./locking";

// Recovery and cancellation cannot know whether the receiver accepted the request.
const abandonDeliveryAttempt = async (
  database: DatabaseTransaction,
  context: LockedDeliveryRun,
  now: Date
): Promise<number> => {
  const attempts = await database
    .update(outboundDeliveryAttempts)
    .set({
      outcome: "unknown",
      finishedAt: sql`greatest(${now.toISOString()}::timestamptz, ${outboundDeliveryAttempts.startedAt})`,
      durationMs: sql`least(2147483647, greatest(0, floor(extract(epoch from (${now.toISOString()}::timestamptz - ${outboundDeliveryAttempts.startedAt})) * 1000)))::integer`
    })
    .where(
      and(
        eq(outboundDeliveryAttempts.workspaceID, context.run.workspaceID),
        eq(outboundDeliveryAttempts.runID, context.run.id),
        eq(outboundDeliveryAttempts.leaseToken, context.run.leaseToken!),
        eq(outboundDeliveryAttempts.outcome, "in_flight")
      )
    )
    .returning({ number: outboundDeliveryAttempts.number });

  if (attempts.length !== 1) throw new Error("Webhook lease has no active attempt");

  return attempts[0]!.number;
};

export { abandonDeliveryAttempt };
