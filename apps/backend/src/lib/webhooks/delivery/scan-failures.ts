import { webhookEndpoints } from "#backend/db/webhooks";
import { outboundDeliveryRuns } from "#backend/db/outbound-deliveries";
import type { db } from "#backend/lib/adapters/postgres";
import { toUUID, toWebhookID, toWorkspaceID } from "#backend/lib/primitives/id";
import { and, asc, gt, sql } from "drizzle-orm";
import { WEBHOOK_FAILURE_PERIOD_MS, WEBHOOK_FAILURE_THRESHOLD } from "./health";

const WEBHOOK_FAILURE_SCAN_BATCH_SIZE = 100;
// No due delivery is required: an exhausted endpoint can cross 72 hours later.
const scanWebhookFailureControls = async (database: typeof db, cursor: string | null = null) => {
  const endpoints = await database
    .select({ workspaceID: webhookEndpoints.workspaceID, endpointID: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(
      and(
        cursor ? gt(webhookEndpoints.id, toUUID(cursor)) : undefined,
        sql`(
        (${webhookEndpoints.enabled} and ${webhookEndpoints.deletedAt} is null
          and ${webhookEndpoints.consecutiveFailures} >= ${WEBHOOK_FAILURE_THRESHOLD}
          and ${webhookEndpoints.firstFailureAt} <= clock_timestamp() - ${WEBHOOK_FAILURE_PERIOD_MS} * interval '1 millisecond')
        or exists (
          select 1 from ${outboundDeliveryRuns}
          where ${outboundDeliveryRuns.workspaceID} = ${webhookEndpoints.workspaceID}
            and ${outboundDeliveryRuns.endpointID} = ${webhookEndpoints.id}
            and ${outboundDeliveryRuns.state} in ('pending', 'in_flight')
            and ((not ${webhookEndpoints.enabled} and ${outboundDeliveryRuns.trigger} <> 'test') or ${webhookEndpoints.deletedAt} is not null
              or ${outboundDeliveryRuns.destinationRevision} <> ${webhookEndpoints.destinationRevision}
              or ${outboundDeliveryRuns.executionGeneration} <> ${webhookEndpoints.executionGeneration})
        )
      )`
      )
    )
    .orderBy(asc(webhookEndpoints.id))
    .limit(WEBHOOK_FAILURE_SCAN_BATCH_SIZE);

  return {
    endpoints: endpoints.map((endpoint) => ({
      workspaceID: toWorkspaceID(endpoint.workspaceID),
      endpointID: toWebhookID(endpoint.endpointID)
    })),
    cursor:
      endpoints.length === WEBHOOK_FAILURE_SCAN_BATCH_SIZE
        ? toWebhookID(endpoints[endpoints.length - 1]!.endpointID)
        : null
  };
};

export { scanWebhookFailureControls };
