import {
  webhookTestInputType,
  type WebhookTestInput
} from "#backend/contracts/schemas/webhook-deliveries";
import { workspaces } from "#backend/db/workspaces";
import { outboundDeliveries, outboundDeliveryRuns } from "#backend/db/outbound-deliveries";
import { outboundEvents } from "#backend/db/outbound-events";
import { withAuthorization } from "#backend/lib/policy";
import {
  generateUUID,
  toUUID,
  toWebhookDeliveryID,
  toWebhookEventID,
  toWebhookOperationID
} from "#backend/lib/primitives/id";
import { webhookCatalog } from "#backend/lib/webhooks/catalog";
import { assertWebhookAuthority } from "#backend/lib/webhooks/delegation";
import { getWebhookConfiguration } from "#backend/lib/webhooks/endpoints";
import { getDeliveryTime } from "#backend/lib/webhooks/delivery/locking";
import { webhookEventType } from "#backend/lib/webhooks/events";
import {
  assertWebhookDestination,
  limitWebhookManagement,
  lockWebhookForUpdate,
  parseWebhookInput
} from "#backend/lib/webhooks/management";
import { webhookManageRequirements } from "#backend/lib/webhooks/permissions";
import { encodeWebhookPayload } from "#backend/lib/webhooks/projection";
import { getWebhookDeliveryRetention } from "#backend/lib/webhooks/retention";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

interface WebhookTestResult {
  deliveryID: string;
}

const WEBHOOK_TEST_DEADLINE_MS = 10 * 60 * 1000;
const sendWebhookTest = withAuthorization<WebhookTestInput, undefined, WebhookTestResult>(
  { permissions: webhookManageRequirements, transaction: "locked-workspace" },
  async ({ database, input, auth }) => {
    const parsed = parseWebhookInput(webhookTestInputType, input);
    const endpoint = await lockWebhookForUpdate(database, auth.workspaceID, parsed);

    await assertWebhookAuthority({
      auth,
      database,
      configuration: getWebhookConfiguration(endpoint),
      retained: true
    });
    assertWebhookDestination(endpoint.url);

    if (!endpoint.eventTypes.includes(parsed.type)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Select an event configured for this webhook"
      });
    }

    await limitWebhookManagement(auth.workspaceID, "test");

    const [workspace] = await database
      .select({ subscriptionPlan: workspaces.subscriptionPlan })
      .from(workspaces)
      .where(eq(workspaces.id, endpoint.workspaceID));
    const now = await getDeliveryTime(database);
    const retention = getWebhookDeliveryRetention(workspace!.subscriptionPlan, now);
    const deliveryID = generateUUID();
    const event = webhookEventType.parse({
      ...webhookCatalog[parsed.type].sample,
      id: toWebhookEventID(generateUUID()),
      operationID: toWebhookOperationID(generateUUID()),
      workspaceID: auth.workspaceID,
      occurredAt: now.toISOString(),
      test: true
    });

    // Samples contain no workspace content and go only to the requested endpoint.
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

    return { deliveryID: toWebhookDeliveryID(deliveryID) };
  }
);

export { sendWebhookTest };
