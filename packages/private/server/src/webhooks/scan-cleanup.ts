import {
  extensions,
  outboundEvents,
  webhookEndpoints,
  workspaces,
  type Database
} from "@andesine/server/database";
import { toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, asc, gt, sql } from "drizzle-orm";

const WEBHOOK_CLEANUP_SCAN_BATCH_SIZE = 100;
// Include workspaces with orphan events even after their last endpoint is gone.
// No Redis state or due delivery is needed to discover cleanup work.
const scanWebhookCleanup = async (database: Database, cursor: string | null = null) => {
  const rows = await database
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        cursor ? gt(workspaces.id, toUUID(cursor)) : undefined,
        sql`(exists (select 1 from ${webhookEndpoints}
        where ${webhookEndpoints.workspaceID} = ${workspaces.id})
        or exists (select 1 from ${outboundEvents}
          where ${outboundEvents.workspaceID} = ${workspaces.id})
        or exists (select 1 from ${extensions}
          where ${extensions.workspaceID} = ${workspaces.id}
            and ${extensions.uninstalledAt} is not null))`
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
