import {
  webhookEndpoints,
  workspaces,
  outboundDeliveries,
  outboundDeliveryRuns,
  type DatabaseTransaction,
  type Database
} from "@andesine/server/database";
import { toUUID, toWebhookRunID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { disableFailedWebhook } from "./health";
import { getDeliveryTime, type LockedDeliveryRun } from "./locking";
import { getDeliveryStopReason, stopDeliveryRun } from "./state";
import { getDeliveryAccessStopReason } from "./access";
import { abandonDeliveryAttempt } from "./abandon";
import { loadWebhookScopeIndex, type WebhookScopeIndex } from "../scope";

interface MaintainWebhookEndpointInput {
  workspaceID: string;
  endpointID: string;
  afterRunID?: string | null;
}
interface WebhookEndpointMaintenanceResult {
  acquired: boolean;
  disabled: boolean;
  stopped: number;
  cursor: string | null;
}

const WEBHOOK_CANCELLATION_BATCH_SIZE = 100;
// Configuration writers must walk every page in the same transaction while holding
// the workspace lock. This prevents a later scope widening from reviving old work.
const reconcileWebhookEndpoint = async (
  transaction: DatabaseTransaction,
  input: MaintainWebhookEndpointInput
): Promise<WebhookEndpointMaintenanceResult> => {
  const workspaceID = toUUID(input.workspaceID);
  const endpointID = toUUID(input.endpointID);
  const [workspace] = await transaction
    .select({ deletingAt: workspaces.deletingAt })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceID))
    .for("update", { skipLocked: true });

  if (!workspace) {
    return { acquired: false, disabled: false, stopped: 0, cursor: input.afterRunID ?? null };
  }

  const [endpoint] = await transaction
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.workspaceID, workspaceID), eq(webhookEndpoints.id, endpointID)))
    .for("update");

  if (!endpoint) return { acquired: true, disabled: false, stopped: 0, cursor: null };

  const now = await getDeliveryTime(transaction);
  const disabled = workspace.deletingAt
    ? false
    : await disableFailedWebhook(transaction, endpoint, now);
  const currentEndpoint = disabled
    ? { ...endpoint, enabled: false, executionGeneration: endpoint.executionGeneration + 1 }
    : endpoint;
  const runs = await transaction
    .select()
    .from(outboundDeliveryRuns)
    .where(
      and(
        eq(outboundDeliveryRuns.workspaceID, workspaceID),
        eq(outboundDeliveryRuns.endpointID, endpointID),
        inArray(outboundDeliveryRuns.state, ["pending", "in_flight"]),
        !disabled && input.afterRunID
          ? gt(outboundDeliveryRuns.id, toUUID(input.afterRunID))
          : undefined
      )
    )
    .orderBy(asc(outboundDeliveryRuns.id))
    .limit(WEBHOOK_CANCELLATION_BATCH_SIZE)
    .for("update");

  let stopped = 0;
  let scopeIndex: WebhookScopeIndex | undefined;

  for (const run of runs) {
    const [delivery] = await transaction
      .select()
      .from(outboundDeliveries)
      .where(
        and(
          eq(outboundDeliveries.workspaceID, workspaceID),
          eq(outboundDeliveries.id, run.deliveryID)
        )
      )
      .for("update");

    if (!delivery) throw new Error("Webhook run has no delivery");

    const context: LockedDeliveryRun = {
      endpoint: currentEndpoint,
      run,
      delivery,
      workspaceDeleting: workspace.deletingAt !== null
    };
    const checkedAt = await getDeliveryTime(transaction);
    const stopReason = getDeliveryStopReason(context, checkedAt);

    scopeIndex ??= stopReason
      ? undefined
      : await loadWebhookScopeIndex({
          database: transaction,
          workspaceID: toWorkspaceID(workspaceID),
          includeDeleted: true
        });

    const reason =
      stopReason ?? (await getDeliveryAccessStopReason(transaction, context, scopeIndex));

    if (!reason) continue;
    if (run.state === "in_flight") await abandonDeliveryAttempt(transaction, context, checkedAt);

    await stopDeliveryRun(
      transaction,
      context,
      reason,
      new Date(Math.max(+checkedAt, +run.createdAt))
    );
    stopped++;
  }

  return {
    acquired: true,
    disabled,
    stopped,
    cursor:
      runs.length === WEBHOOK_CANCELLATION_BATCH_SIZE
        ? toWebhookRunID(runs[runs.length - 1]!.id)
        : null
  };
};
// Background maintenance uses one bounded page per transaction. Disabled/deleted
// endpoints and destination/generation fences already prevent further dispatch.
const maintainWebhookEndpoint = (
  database: Database,
  input: MaintainWebhookEndpointInput
): Promise<WebhookEndpointMaintenanceResult> =>
  database.transaction((transaction) => reconcileWebhookEndpoint(transaction, input));

export { maintainWebhookEndpoint, reconcileWebhookEndpoint, WEBHOOK_CANCELLATION_BATCH_SIZE };
export type { MaintainWebhookEndpointInput, WebhookEndpointMaintenanceResult };
