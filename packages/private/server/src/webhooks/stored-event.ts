import {
  outboundEvents,
  type outboundDeliveries,
  type DatabaseClient
} from "@andesine/server/database";
import { toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, eq } from "drizzle-orm";
import { webhookEventType } from "@andesine/contracts/webhooks";

const loadStoredWebhookEvent = async (
  database: DatabaseClient,
  delivery: typeof outboundDeliveries.$inferSelect
) => {
  const event = webhookEventType.parse(JSON.parse(delivery.payload.toString("utf8")));
  const [source] = await database
    .select({
      id: outboundEvents.id,
      operationID: outboundEvents.operationID,
      type: outboundEvents.type,
      schemaVersion: outboundEvents.schemaVersion,
      test: outboundEvents.test
    })
    .from(outboundEvents)
    .where(
      and(
        eq(outboundEvents.workspaceID, delivery.workspaceID),
        eq(outboundEvents.id, delivery.eventID)
      )
    );

  if (
    !source ||
    toUUID(event.id) !== source.id ||
    toUUID(event.operationID) !== source.operationID ||
    event.workspaceID !== toWorkspaceID(delivery.workspaceID) ||
    event.type !== source.type ||
    event.test !== source.test ||
    event.schemaVersion !== source.schemaVersion
  ) {
    throw new Error("Invalid stored webhook delivery payload");
  }

  return event;
};

export { loadStoredWebhookEvent };
