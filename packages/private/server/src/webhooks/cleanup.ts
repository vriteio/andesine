import {
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundEvents,
  webhookEndpoints,
  webhookEndpointRevisions,
  workspaces,
  type Database
} from "@andesine/server/database";
import { toUUID } from "@andesine/contracts/primitives";
import { and, asc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getDeliveryTime } from "./delivery/locking";

interface WebhookCleanupResult {
  acquired: boolean;
  deliveries: number;
  events: number;
  revisions: number;
  endpoints: number;
  retiredKeys: number;
  more: boolean;
}

const WEBHOOK_CLEANUP_BATCH_SIZE = 100;
// All webhook writers take the workspace lock first. It also protects the FK
// cascades below, which delete children without following dispatch's row order.
// Each limit bounds parent rows; cascaded runs, attempts and ancestry can be larger.
const cleanupWebhookWorkspace = async (
  database: Database,
  publicWorkspaceID: string
): Promise<WebhookCleanupResult> =>
  database.transaction(async (transaction) => {
    const workspaceID = toUUID(publicWorkspaceID);
    const [workspace] = await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceID))
      .for("update", { skipLocked: true });
    const result: WebhookCleanupResult = {
      acquired: Boolean(workspace),
      deliveries: 0,
      events: 0,
      revisions: 0,
      endpoints: 0,
      retiredKeys: 0,
      more: false
    };

    if (!workspace) return result;

    const now = await getDeliveryTime(transaction);
    const expiredDeliveries = await transaction
      .select({ id: outboundDeliveries.id })
      .from(outboundDeliveries)
      .where(
        and(eq(outboundDeliveries.workspaceID, workspaceID), lte(outboundDeliveries.expiresAt, now))
      )
      .orderBy(asc(outboundDeliveries.expiresAt), asc(outboundDeliveries.id))
      .limit(WEBHOOK_CLEANUP_BATCH_SIZE);

    if (expiredDeliveries.length) {
      // Expiry ends eligibility even for pending/in-flight work. Old Redis jobs
      // and late HTTP results become harmless misses after this cascade.
      await transaction.delete(outboundDeliveries).where(
        and(
          eq(outboundDeliveries.workspaceID, workspaceID),
          inArray(
            outboundDeliveries.id,
            expiredDeliveries.map(({ id }) => id)
          )
        )
      );
      result.deliveries = expiredDeliveries.length;
    }

    const unusedEvents = await transaction
      .select({ id: outboundEvents.id })
      .from(outboundEvents)
      .where(
        and(
          eq(outboundEvents.workspaceID, workspaceID),
          sql`not exists (select 1 from ${outboundDeliveries}
          where ${outboundDeliveries.workspaceID} = ${outboundEvents.workspaceID}
            and ${outboundDeliveries.eventID} = ${outboundEvents.id})`
        )
      )
      .orderBy(asc(outboundEvents.createdAt), asc(outboundEvents.id))
      .limit(WEBHOOK_CLEANUP_BATCH_SIZE);

    if (unusedEvents.length) {
      await transaction.delete(outboundEvents).where(
        and(
          eq(outboundEvents.workspaceID, workspaceID),
          inArray(
            outboundEvents.id,
            unusedEvents.map(({ id }) => id)
          )
        )
      );
      result.events = unusedEvents.length;
    }

    const unusedRevisions = transaction
      .select({
        endpointID: webhookEndpointRevisions.endpointID,
        revision: webhookEndpointRevisions.revision
      })
      .from(webhookEndpointRevisions)
      .where(
        and(
          eq(webhookEndpointRevisions.workspaceID, workspaceID),
          sql`not exists (select 1 from ${webhookEndpoints}
          where ${webhookEndpoints.workspaceID} = ${webhookEndpointRevisions.workspaceID}
            and ${webhookEndpoints.id} = ${webhookEndpointRevisions.endpointID}
            and ${webhookEndpoints.revision} = ${webhookEndpointRevisions.revision})`,
          sql`not exists (select 1 from ${outboundDeliveries}
          where ${outboundDeliveries.workspaceID} = ${webhookEndpointRevisions.workspaceID}
            and ${outboundDeliveries.endpointID} = ${webhookEndpointRevisions.endpointID}
            and ${outboundDeliveries.selectedRevision} = ${webhookEndpointRevisions.revision})`,
          sql`not exists (select 1 from ${outboundDeliveryRuns}
          where ${outboundDeliveryRuns.workspaceID} = ${webhookEndpointRevisions.workspaceID}
            and ${outboundDeliveryRuns.endpointID} = ${webhookEndpointRevisions.endpointID}
            and ${outboundDeliveryRuns.configurationRevision} = ${webhookEndpointRevisions.revision})`
        )
      )
      .orderBy(asc(webhookEndpointRevisions.endpointID), asc(webhookEndpointRevisions.revision))
      .limit(WEBHOOK_CLEANUP_BATCH_SIZE);
    const removedRevisions = await transaction
      .delete(webhookEndpointRevisions)
      .where(
        and(
          eq(webhookEndpointRevisions.workspaceID, workspaceID),
          sql`(${webhookEndpointRevisions.endpointID}, ${webhookEndpointRevisions.revision}) in (${unusedRevisions})`
        )
      )
      .returning({ revision: webhookEndpointRevisions.revision });

    result.revisions = removedRevisions.length;

    const tombstones = await transaction
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.workspaceID, workspaceID),
          isNotNull(webhookEndpoints.deletedAt),
          sql`not exists (select 1 from ${outboundDeliveries}
          where ${outboundDeliveries.workspaceID} = ${webhookEndpoints.workspaceID}
            and ${outboundDeliveries.endpointID} = ${webhookEndpoints.id})`,
          // Prune historical revisions in bounded batches first. The endpoint
          // cascade then removes only its current configuration revision.
          sql`not exists (select 1 from ${webhookEndpointRevisions}
          where ${webhookEndpointRevisions.workspaceID} = ${webhookEndpoints.workspaceID}
            and ${webhookEndpointRevisions.endpointID} = ${webhookEndpoints.id}
            and ${webhookEndpointRevisions.revision} <> ${webhookEndpoints.revision})`
        )
      )
      .orderBy(asc(webhookEndpoints.deletedAt), asc(webhookEndpoints.id))
      .limit(WEBHOOK_CLEANUP_BATCH_SIZE);

    if (tombstones.length) {
      await transaction.delete(webhookEndpoints).where(
        and(
          eq(webhookEndpoints.workspaceID, workspaceID),
          inArray(
            webhookEndpoints.id,
            tombstones.map(({ id }) => id)
          )
        )
      );
      result.endpoints = tombstones.length;
    }

    const retiredKeys = await transaction
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.workspaceID, workspaceID),
          lte(webhookEndpoints.previousSecretExpiresAt, now)
        )
      )
      .orderBy(asc(webhookEndpoints.previousSecretExpiresAt), asc(webhookEndpoints.id))
      .limit(WEBHOOK_CLEANUP_BATCH_SIZE);

    if (retiredKeys.length) {
      // Rotation takes the same workspace lock. Never decrypt an expired key,
      // change the current key, or create a configuration revision for cleanup.
      await transaction
        .update(webhookEndpoints)
        .set({ previousSecretCiphertext: null, previousSecretExpiresAt: null })
        .where(
          and(
            eq(webhookEndpoints.workspaceID, workspaceID),
            inArray(
              webhookEndpoints.id,
              retiredKeys.map(({ id }) => id)
            )
          )
        );
      result.retiredKeys = retiredKeys.length;
    }

    result.more = [
      result.deliveries,
      result.events,
      result.revisions,
      result.endpoints,
      result.retiredKeys
    ].some((count) => count === WEBHOOK_CLEANUP_BATCH_SIZE);

    return result;
  });

export { cleanupWebhookWorkspace, WEBHOOK_CLEANUP_BATCH_SIZE };
export type { WebhookCleanupResult };
