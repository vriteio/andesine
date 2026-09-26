import {
  webhookDeliveryListInputType,
  type WebhookDeliveryListInput,
  type WebhookDelivery
} from "#backend/contracts/schemas/webhook-deliveries";
import { outboundDeliveries } from "#backend/db/outbound-deliveries";
import { outboundEvents } from "#backend/db/outbound-events";
import { toPage, type Page } from "#backend/lib/api/pagination";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives/id";
import { getDeliveryTime } from "#backend/lib/webhooks/delivery/locking";
import { loadWebhookEndpoint } from "#backend/lib/webhooks/endpoints";
import { describeWebhookDeliveries } from "#backend/lib/webhooks/history/describe";
import { loadWebhookDelivery } from "#backend/lib/webhooks/history/records";
import { parseWebhookInput } from "#backend/lib/webhooks/management";
import { webhookReadRequirements } from "#backend/lib/webhooks/permissions";
import { and, desc, eq, getTableColumns, gt, lt, or } from "drizzle-orm";

const listWebhookDeliveries = withAuthorization<
  WebhookDeliveryListInput,
  undefined,
  Page<WebhookDelivery>
>(
  { permissions: webhookReadRequirements, transaction: "snapshot" },
  async ({ database, input, auth }) => {
    const page = parseWebhookInput(webhookDeliveryListInputType, input);
    const workspaceID = auth.workspaceID;
    const now = await getDeliveryTime(database);

    await loadWebhookEndpoint(database, { workspaceID, id: page.id, includeDeleted: true });

    const cursor = page.cursor
      ? await loadWebhookDelivery(database, {
          workspaceID,
          id: page.id,
          deliveryID: page.cursor,
          now
        })
      : null;
    const { payload: _payload, ...columns } = getTableColumns(outboundDeliveries);
    const rows = await database
      .select({
        delivery: columns,
        event: {
          type: outboundEvents.type,
          occurredAt: outboundEvents.occurredAt,
          test: outboundEvents.test
        }
      })
      .from(outboundDeliveries)
      .innerJoin(
        outboundEvents,
        and(
          eq(outboundEvents.workspaceID, outboundDeliveries.workspaceID),
          eq(outboundEvents.id, outboundDeliveries.eventID)
        )
      )
      .where(
        and(
          eq(outboundDeliveries.workspaceID, toUUID(workspaceID)),
          eq(outboundDeliveries.endpointID, toUUID(page.id)),
          gt(outboundDeliveries.expiresAt, now),
          page.type ? eq(outboundEvents.type, page.type) : undefined,
          page.state ? eq(outboundDeliveries.state, page.state) : undefined,
          page.createdAfter
            ? gt(outboundDeliveries.createdAt, new Date(page.createdAfter))
            : undefined,
          page.createdBefore
            ? lt(outboundDeliveries.createdAt, new Date(page.createdBefore))
            : undefined,
          cursor
            ? or(
                lt(outboundDeliveries.createdAt, cursor.createdAt),
                and(
                  eq(outboundDeliveries.createdAt, cursor.createdAt),
                  lt(outboundDeliveries.id, cursor.id)
                )
              )
            : undefined
        )
      )
      .orderBy(desc(outboundDeliveries.createdAt), desc(outboundDeliveries.id))
      .limit(page.limit + 1);

    return toPage(await describeWebhookDeliveries(database, rows), page.limit);
  }
);

export { listWebhookDeliveries };
