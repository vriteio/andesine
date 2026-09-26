import { outboundEvents } from "#backend/db/outbound-events";
import { webhookEndpoints } from "#backend/db/webhooks";
import { workspaces } from "#backend/db/workspaces";
import type { db } from "#backend/lib/adapters/postgres";
import { toUUID, toWorkspaceID } from "#backend/lib/primitives/id";
import { and, asc, gt, sql } from "drizzle-orm";

const WEBHOOK_CLEANUP_SCAN_BATCH_SIZE = 100;
// Include workspaces with orphan events even after their last endpoint is gone.
// No Redis state or due delivery is needed to discover cleanup work.
const scanWebhookCleanup = async (database: typeof db, cursor: string | null = null) => {
  const rows = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        cursor ? gt(workspaces.id, toUUID(cursor)) : undefined,
        sql`(exists (select 1 from ${webhookEndpoints}
        where ${webhookEndpoints.workspaceID} = ${workspaces.id})
        or exists (select 1 from ${outboundEvents}
          where ${outboundEvents.workspaceID} = ${workspaces.id}))`
      )
    )
    .orderBy(asc(workspaces.id))
    .limit(WEBHOOK_CLEANUP_SCAN_BATCH_SIZE);
  const workspaceIDs = rows.map(({ id }) => toWorkspaceID(id));

  return {
    workspaceIDs,
    cursor:
      rows.length === WEBHOOK_CLEANUP_SCAN_BATCH_SIZE
        ? workspaceIDs[workspaceIDs.length - 1]!
        : null
  };
};

export { scanWebhookCleanup };
