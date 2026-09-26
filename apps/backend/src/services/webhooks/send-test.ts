import {
  workspaces,
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundEvents
} from "@andesine/server/database";
import { generateUUID } from "@andesine/server/primitives";
import { getWebhookConfiguration, encodeWebhookPayload } from "@andesine/server/webhooks/recording";
import { getDeliveryTime } from "@andesine/server/webhooks/delivery";
import { getWebhookDeliveryRetention } from "@andesine/server/webhooks/retention";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import {
  webhookTestInputType,
  type WebhookTestInput,
  webhookEventType,
  webhookManageRequirements
} from "@andesine/contracts/webhooks";
import { withAuthorization } from "#backend/lib/policy";
import {
  toUUID,
  toWebhookDeliveryID,
  toWebhookEventID,
  toWebhookOperationID
} from "@andesine/contracts/primitives";
import { webhookCatalog } from "#backend/lib/webhooks/catalog";
import { assertWebhookAuthority } from "#backend/lib/webhooks/delegation";
import {
  assertWebhookDestination,
  limitWebhookManagement,
  lockWebhookForUpdate,
  parseWebhookInput
} from "#backend/lib/webhooks/management";
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
    const retention = getWebhookDeliveryRetention(
      workspace!.subscriptionPlan,
      now,
      webhookRetentionPolicy
    );
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
