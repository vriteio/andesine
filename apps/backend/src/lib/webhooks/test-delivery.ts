import {
  workspaces,
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundEvents,
  type DatabaseTransaction
} from "@andesine/server/database";
import { generateUUID } from "@andesine/server/primitives";
import { encodeWebhookPayload, type WebhookEndpointRow } from "@andesine/server/webhooks/recording";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { getWebhookDeliveryRetention } from "@andesine/server/webhooks/retention";
import { webhookEventType, type WebhookEventName } from "@andesine/contracts/webhooks";
import {
  toUUID,
  toWebhookDeliveryID,
  toWebhookEventID,
  toWebhookOperationID,
  toWorkspaceID
} from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";
import { webhookCatalog } from "./catalog";
import { webhookRetentionPolicy } from "./policy";

const WEBHOOK_TEST_DEADLINE_MS = 10 * 60 * 1000;

/** Samples contain no workspace content and go only to the given endpoint. */
const createWebhookTestDelivery = async (
  database: DatabaseTransaction,
  endpoint: WebhookEndpointRow,
  type: WebhookEventName
): Promise<string> => {
  const [workspace] = await database
    .select({ subscriptionPlan: workspaces.subscriptionPlan })
    .from(workspaces)
    .where(eq(workspaces.id, endpoint.workspaceID));
  const now = await getDeliveryTime(database);
  const retention = getWebhookDeliveryRetention(
    workspace!.subscriptionPlan,
    now,
    webhookRetentionPolicy
  );
  const deliveryID = generateUUID();
  const event = webhookEventType.parse({
    ...webhookCatalog[type].sample,
    id: toWebhookEventID(generateUUID()),
    operationID: toWebhookOperationID(generateUUID()),
    workspaceID: toWorkspaceID(endpoint.workspaceID),
    occurredAt: now.toISOString(),
    test: true
  });

  await database.insert(outboundEvents).values({
    id: toUUID(event.id),
    workspaceID: endpoint.workspaceID,
    operationID: toUUID(event.operationID),
    type: event.type,
    schemaVersion: event.schemaVersion,
    subject: event.subject,
    data: event.data,
    test: true,
    occurredAt: now,
    createdAt: now
  });
  await database.insert(outboundDeliveries).values({
    id: deliveryID,
    workspaceID: endpoint.workspaceID,
    endpointID: endpoint.id,
    eventID: toUUID(event.id),
    selectedRevision: endpoint.revision,
    payload: encodeWebhookPayload(event),
    ...retention
  });
  await database.insert(outboundDeliveryRuns).values({
    workspaceID: endpoint.workspaceID,
    endpointID: endpoint.id,
    deliveryID,
    number: 1,
    trigger: "test",
    configurationRevision: endpoint.revision,
    destinationRevision: endpoint.destinationRevision,
    executionGeneration: endpoint.executionGeneration,
    createdAt: now,
    expiresAt: retention.expiresAt,
    deadlineAt: new Date(Math.min(+now + WEBHOOK_TEST_DEADLINE_MS, +retention.expiresAt)),
    nextAttemptAt: now
  });

  return toWebhookDeliveryID(deliveryID);
};

export { createWebhookTestDelivery };
