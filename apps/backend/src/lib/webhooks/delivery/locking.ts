import { outboundDeliveries, outboundDeliveryRuns } from "#backend/db/outbound-deliveries";
import { webhookEndpoints } from "#backend/db/webhooks";
import { workspaces } from "#backend/db/workspaces";
import type { DatabaseTransaction } from "#backend/lib/adapters/postgres";
import { toUUID } from "#backend/lib/primitives/id";
import { and, eq, sql } from "drizzle-orm";

interface DeliveryRunIdentity {
  workspaceID: string;
  runID: string;
}
interface LockedDeliveryRun {
  endpoint: typeof webhookEndpoints.$inferSelect;
  run: typeof outboundDeliveryRuns.$inferSelect;
  delivery: typeof outboundDeliveries.$inferSelect;
  workspaceDeleting: boolean;
}

const getDeliveryTime = async (database: DatabaseTransaction): Promise<Date> => {
  const result = await database.execute<{ now: string }>(
    sql`select clock_timestamp()::text as now`
  );

  return new Date(result.rows[0]!.now);
};
// All ledger/configuration writers use workspace -> endpoint -> run -> delivery.
// Claims and recovery skip busy work; completion waits for the workspace lock.
const lockDeliveryRun = async (
  database: DatabaseTransaction,
  identity: DeliveryRunIdentity,
  skipLocked = true
): Promise<LockedDeliveryRun | null> => {
  const workspaceID = toUUID(identity.workspaceID);
  const runID = toUUID(identity.runID);
  const [workspace] = await database
    .select({ deletingAt: workspaces.deletingAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceID))
    .for("update", skipLocked ? { skipLocked: true } : undefined);

  if (!workspace) return null;

  const [owner] = await database
    .select({ endpointID: outboundDeliveryRuns.endpointID })
    .from(outboundDeliveryRuns)
    .where(
      and(eq(outboundDeliveryRuns.workspaceID, workspaceID), eq(outboundDeliveryRuns.id, runID))
    );

  if (!owner) return null;

  const [endpoint] = await database
    .select()
    .from(webhookEndpoints)
    .where(
      and(eq(webhookEndpoints.workspaceID, workspaceID), eq(webhookEndpoints.id, owner.endpointID))
    )
    .for("update");
  const [run] = await database
    .select()
    .from(outboundDeliveryRuns)
    .where(
      and(eq(outboundDeliveryRuns.workspaceID, workspaceID), eq(outboundDeliveryRuns.id, runID))
    )
    .for("update");

  if (!endpoint || !run) return null;

  const [delivery] = await database
    .select()
    .from(outboundDeliveries)
    .where(
      and(
        eq(outboundDeliveries.workspaceID, workspaceID),
        eq(outboundDeliveries.id, run.deliveryID)
      )
    )
    .for("update");

  if (!delivery) return null;

  return { endpoint, run, delivery, workspaceDeleting: workspace.deletingAt !== null };
};

export { lockDeliveryRun, getDeliveryTime };
export type { DeliveryRunIdentity, LockedDeliveryRun };
