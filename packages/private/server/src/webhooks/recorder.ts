import {
  extensions,
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundEvents,
  outboundEventResources,
  webhookEndpoints,
  webhookEndpointRevisions,
  workspaces,
  type DatabaseTransaction as Database
} from "@andesine/server/database";
import type { WebhookRetentionPolicy } from "./retention";
import { outboundConfigurationType } from "@andesine/contracts/webhooks";
import { generateUUID } from "../primitives/id";
import { toUUID } from "@andesine/contracts/primitives";
import { and, eq, isNull, sql } from "drizzle-orm";
import { loadWebhookScopeIndex, type WebhookScopeIndex } from "./scope";
import { createWebhookOperation, type WebhookOperation } from "./operation";
import { encodeWebhookPayload, projectWebhookEvent } from "./projection";
import {
  getWebhookResourceRows,
  validateWebhookEventChange,
  type WebhookEventChange
} from "./recording-context";
import { getWebhookDeliveryRetention } from "./retention";
import { getDeliveryTime } from "./delivery/locking";

interface CreateWebhookRecorderInput {
  retentionPolicy: WebhookRetentionPolicy;
  database: Database;
  operation: WebhookOperation;
}
interface WebhookRecorder {
  before: WebhookScopeIndex;
  record: (changes: Iterable<WebhookEventChange>) => Promise<void>;
}

const INSERT_BATCH_SIZE = 250;

// Call before mutation reads/writes, inside their transaction. Endpoint changes must
// take this same workspace lock first. Nested writers reuse this recorder/operation.
const createWebhookRecorder = async (
  input: CreateWebhookRecorderInput
): Promise<WebhookRecorder> => {
  const { database } = input;
  const operation = createWebhookOperation(
    input.operation.workspaceID,
    input.operation.id,
    input.operation.originExtensionID
  );
  const originExtensionID = operation.originExtensionID && toUUID(operation.originExtensionID);
  const workspaceID = toUUID(operation.workspaceID);

  if (typeof database.rollback !== "function") {
    throw new Error("Webhook recording requires an existing database transaction");
  }

  const [workspace] = await database
    .select({ subscriptionPlan: workspaces.subscriptionPlan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceID))
    .for("update");

  if (!workspace) throw new Error("Webhook workspace not found");

  const endpointRows = await database
    .select({
      id: webhookEndpoints.id,
      revision: webhookEndpoints.revision,
      destinationRevision: webhookEndpoints.destinationRevision,
      executionGeneration: webhookEndpoints.executionGeneration,
      kind: webhookEndpoints.kind,
      extensionID: webhookEndpoints.extensionID,
      extensionActive: sql<boolean>`coalesce(${extensions.enabled} and ${extensions.disabledReason} is null and ${extensions.uninstalledAt} is null, false)`,
      configuration: webhookEndpointRevisions.configuration
    })
    .from(webhookEndpoints)
    .leftJoin(extensions, eq(extensions.id, webhookEndpoints.extensionID))
    .leftJoin(
      webhookEndpointRevisions,
      and(
        eq(webhookEndpointRevisions.workspaceID, webhookEndpoints.workspaceID),
        eq(webhookEndpointRevisions.endpointID, webhookEndpoints.id),
        eq(webhookEndpointRevisions.revision, webhookEndpoints.revision),
        eq(webhookEndpointRevisions.destinationRevision, webhookEndpoints.destinationRevision)
      )
    )
    .where(
      and(
        eq(webhookEndpoints.workspaceID, workspaceID),
        eq(webhookEndpoints.enabled, true),
        isNull(webhookEndpoints.deletedAt)
      )
    );
  const endpoints = endpointRows.map((endpoint) => {
    const configuration = outboundConfigurationType.parse(endpoint.configuration);

    if (!configuration.enabled) throw new Error("Webhook configuration revision is not enabled");

    return { ...endpoint, configuration };
  });
  const before = await loadWebhookScopeIndex({
    database,
    workspaceID: operation.workspaceID,
    includeDeleted: true
  });
  const record = async (changes: Iterable<WebhookEventChange>): Promise<void> => {
    const index = await loadWebhookScopeIndex({
      database,
      workspaceID: operation.workspaceID,
      includeDeleted: true
    });
    const createdAt = await getDeliveryTime(database);
    const retention = getWebhookDeliveryRetention(
      workspace.subscriptionPlan,
      createdAt,
      input.retentionPolicy
    );
    const deadlineAt = new Date(
      Math.min(createdAt.getTime() + 72 * 3_600_000, +retention.expiresAt)
    );

    for (const inputChange of changes) {
      const change = validateWebhookEventChange(inputChange, operation, index);
      const { event } = change;
      const eventID = toUUID(event.id);
      const deliveries: Array<typeof outboundDeliveries.$inferInsert> = [];
      const runs: Array<typeof outboundDeliveryRuns.$inferInsert> = [];

      for (const endpoint of endpoints) {
        // Lifecycle events reach only the described extension, even when inactive; other events
        // reach only active extensions, except the one that made the change.
        const isSelectable =
          event.subject.kind === "extension"
            ? endpoint.extensionID === toUUID(event.subject.id)
            : endpoint.kind === "http" ||
              (endpoint.extensionActive && endpoint.extensionID !== originExtensionID);

        if (!isSelectable) continue;

        const payload = projectWebhookEvent(change, endpoint.configuration, index);

        if (!payload) continue;

        const deliveryID = generateUUID();

        deliveries.push({
          id: deliveryID,
          workspaceID,
          endpointID: endpoint.id,
          eventID,
          selectedRevision: endpoint.revision,
          payload: encodeWebhookPayload(payload),
          ...retention
        });
        runs.push({
          workspaceID,
          endpointID: endpoint.id,
          deliveryID,
          number: 1,
          trigger: "automatic",
          configurationRevision: endpoint.revision,
          destinationRevision: endpoint.destinationRevision,
          executionGeneration: endpoint.executionGeneration,
          createdAt,
          expiresAt: retention.expiresAt,
          deadlineAt,
          nextAttemptAt: createdAt
        });
      }

      // There is no historical backfill. Producers must skip already committed job
      // items; a duplicate retained event ID fails the transaction rather than adding
      // recipients from a later configuration. Do not catch recording errors to commit.
      if (!deliveries.length) continue;

      await database.insert(outboundEvents).values({
        id: eventID,
        workspaceID,
        operationID: toUUID(operation.id),
        type: event.type,
        schemaVersion: event.schemaVersion,
        subject: event.subject,
        data: event.data,
        test: false,
        occurredAt: new Date(event.occurredAt),
        createdAt
      });

      const resources = getWebhookResourceRows(change);

      for (let offset = 0; offset < resources.length; offset += INSERT_BATCH_SIZE) {
        await database
          .insert(outboundEventResources)
          .values(resources.slice(offset, offset + INSERT_BATCH_SIZE));
      }

      for (let offset = 0; offset < deliveries.length; offset += INSERT_BATCH_SIZE) {
        await database
          .insert(outboundDeliveries)
          .values(deliveries.slice(offset, offset + INSERT_BATCH_SIZE));
        await database
          .insert(outboundDeliveryRuns)
          .values(runs.slice(offset, offset + INSERT_BATCH_SIZE));
      }
    }
  };

  return { before, record };
};

export { createWebhookRecorder };
export type { WebhookRecorder };
