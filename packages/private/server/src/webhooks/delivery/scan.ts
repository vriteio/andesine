import { outboundDeliveryRuns, type Database } from "@andesine/server/database";
import { toUUID, toWebhookRunID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, asc, eq, gt, lte, or, sql } from "drizzle-orm";
import { getDeliveryTime, type DeliveryRunIdentity } from "./locking";

interface DeliveryScanCursor {
  nextAttemptAt: string;
  runID: string;
}
interface DueDeliveryRun extends DeliveryRunIdentity {
  nextAttemptAt: string;
}
interface DeliveryScanResult {
  acquired: boolean;
  due: DueDeliveryRun[];
  abandoned: DeliveryRunIdentity[];
  cursor: DeliveryScanCursor | null;
}

const WEBHOOK_SCAN_BATCH_SIZE = 100;
const scanDeliveryRuns = async (
  database: Database,
  cursor: DeliveryScanCursor | null = null
): Promise<DeliveryScanResult> =>
  database.transaction(async (transaction) => {
    const lock = await transaction.execute<{ acquired: boolean }>(sql`
    select pg_try_advisory_xact_lock(hashtext('andesine:webhooks:scan')) as acquired
  `);

    if (!lock.rows[0]?.acquired) return { acquired: false, due: [], abandoned: [], cursor };

    const now = await getDeliveryTime(transaction);
    const due = await transaction
      .select({
        workspaceID: outboundDeliveryRuns.workspaceID,
        runID: outboundDeliveryRuns.id,
        nextAttemptAt: sql<string>`${outboundDeliveryRuns.nextAttemptAt}::text`
      })
      .from(outboundDeliveryRuns)
      .where(
        and(
          eq(outboundDeliveryRuns.state, "pending"),
          lte(outboundDeliveryRuns.nextAttemptAt, now),
          cursor
            ? or(
                sql`${outboundDeliveryRuns.nextAttemptAt} > ${cursor.nextAttemptAt}::timestamptz`,
                and(
                  sql`${outboundDeliveryRuns.nextAttemptAt} = ${cursor.nextAttemptAt}::timestamptz`,
                  gt(outboundDeliveryRuns.id, toUUID(cursor.runID))
                )
              )
            : undefined
        )
      )
      .orderBy(asc(outboundDeliveryRuns.nextAttemptAt), asc(outboundDeliveryRuns.id))
      .limit(WEBHOOK_SCAN_BATCH_SIZE);
    const abandoned = await transaction
      .select({ workspaceID: outboundDeliveryRuns.workspaceID, runID: outboundDeliveryRuns.id })
      .from(outboundDeliveryRuns)
      .where(
        and(
          eq(outboundDeliveryRuns.state, "in_flight"),
          or(
            lte(outboundDeliveryRuns.leaseExpiresAt, now),
            lte(outboundDeliveryRuns.deadlineAt, now)
          )
        )
      )
      .orderBy(asc(outboundDeliveryRuns.leaseExpiresAt), asc(outboundDeliveryRuns.id))
      .limit(WEBHOOK_SCAN_BATCH_SIZE);
    const mapped = due.map((run) => ({
      workspaceID: toWorkspaceID(run.workspaceID),
      runID: toWebhookRunID(run.runID),
      nextAttemptAt: run.nextAttemptAt
    }));
    const last = mapped[mapped.length - 1];

    return {
      acquired: true,
      due: mapped,
      abandoned: abandoned.map((run) => ({
        workspaceID: toWorkspaceID(run.workspaceID),
        runID: toWebhookRunID(run.runID)
      })),
      cursor:
        due.length === WEBHOOK_SCAN_BATCH_SIZE && last
          ? { nextAttemptAt: last.nextAttemptAt, runID: last.runID }
          : null
    };
  });

export { scanDeliveryRuns, WEBHOOK_SCAN_BATCH_SIZE };
export type { DeliveryScanCursor, DueDeliveryRun };
