import {
  outboundDeliveries,
  outboundDeliveryRuns,
  type DatabaseTransaction
} from "@andesine/server/database";
import { getDeliveryAccessStopReason, getDeliveryTime } from "@andesine/server/webhooks/delivery";
import {
  getWebhookConfiguration,
  loadStoredWebhookEvent,
  loadWebhookEndpoint
} from "@andesine/server/webhooks/recording";
import {
  type WebhookBulkRedeliveryInput,
  type WebhookDeliveryInput,
  type WebhookRun
} from "@andesine/contracts/webhooks";
import type { SessionData } from "#backend/lib/policy/session";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { assertWebhookAuthority } from "../delegation";
import {
  assertWebhookDestination,
  assertWebhookWorkspace,
  limitWebhookManagement
} from "../management";
import { describeWebhookRun } from "./describe";
import { readRetainedWebhookPayload } from "./payload";
import { loadWebhookDelivery } from "./records";

type WebhookEndpointRow = Awaited<ReturnType<typeof loadWebhookEndpoint>>;

const redeliverWebhookDelivery = async (
  database: DatabaseTransaction,
  auth: SessionData,
  endpoint: WebhookEndpointRow,
  input: WebhookDeliveryInput
): Promise<WebhookRun> => {
  const workspaceID = auth.workspaceID;
  const [latest] = await database
    .select()
    .from(outboundDeliveryRuns)
    .where(
      and(
        eq(outboundDeliveryRuns.workspaceID, toUUID(workspaceID)),
        eq(outboundDeliveryRuns.endpointID, endpoint.id),
        eq(outboundDeliveryRuns.deliveryID, toUUID(input.deliveryID))
      )
    )
    .orderBy(desc(outboundDeliveryRuns.number))
    .limit(1)
    .for("update");
  const checkedAt = await getDeliveryTime(database);
  const delivery = await loadWebhookDelivery(database, {
    ...input,
    workspaceID,
    now: checkedAt,
    lock: true,
    extensionID: endpoint.extensionID ?? undefined
  });
  // Extension webhooks send a notification, not the payload; the access check below applies.
  const { event, allowed } =
    endpoint.kind === "extension"
      ? { event: await loadStoredWebhookEvent(database, delivery), allowed: true }
      : await readRetainedWebhookPayload(database, auth, delivery);

  if (!allowed) {
    throw new ORPCError("FORBIDDEN", {
      message: "You cannot export this retained webhook payload"
    });
  }

  if (event.test) {
    throw new ORPCError("CONFLICT", {
      message: "Request a new webhook test instead of replaying a sample"
    });
  }

  if (latest && (latest.state === "pending" || latest.state === "in_flight")) {
    throw new ORPCError("CONFLICT", { message: "This delivery already has an active run" });
  }

  const now = await getDeliveryTime(database);

  if (delivery.expiresAt <= now) {
    throw new ORPCError("NOT_FOUND", { message: "Webhook delivery is unavailable" });
  }

  const [run] = await database
    .insert(outboundDeliveryRuns)
    .values({
      workspaceID: endpoint.workspaceID,
      endpointID: endpoint.id,
      deliveryID: delivery.id,
      number: (latest?.number ?? 0) + 1,
      trigger: "manual",
      configurationRevision: endpoint.revision,
      destinationRevision: endpoint.destinationRevision,
      executionGeneration: endpoint.executionGeneration,
      createdAt: now,
      expiresAt: delivery.expiresAt,
      deadlineAt: new Date(Math.min(+now + 72 * 3_600_000, +delivery.expiresAt)),
      nextAttemptAt: now
    })
    .returning();
  const reason = await getDeliveryAccessStopReason(database, {
    endpoint,
    delivery,
    run: run!,
    workspaceDeleting: false
  });

  if (reason) {
    throw new ORPCError("FORBIDDEN", {
      message: "The current webhook configuration does not allow this payload"
    });
  }

  await database
    .update(outboundDeliveries)
    .set({ state: "pending" })
    .where(eq(outboundDeliveries.id, delivery.id));

  return describeWebhookRun(run!);
};
// Checks the endpoint once and replays each delivery; the request counts once for rate limiting.
const redeliverWebhookDeliveries = async (
  database: DatabaseTransaction,
  auth: SessionData,
  input: WebhookBulkRedeliveryInput
): Promise<WebhookRun[]> => {
  const workspaceID = auth.workspaceID;
  const runs: WebhookRun[] = [];

  await assertWebhookWorkspace(database, workspaceID);

  const endpoint = await loadWebhookEndpoint(database, {
    workspaceID,
    id: input.id,
    includeDeleted: true,
    lock: true
  });

  if (!endpoint.enabled || endpoint.deletedAt) {
    throw new ORPCError("CONFLICT", { message: "Redelivery requires an enabled webhook" });
  }

  if (endpoint.destinationRevision !== input.expectedDestinationRevision) {
    throw new ORPCError("CONFLICT", {
      message: "The webhook destination changed; review it before redelivery"
    });
  }

  await assertWebhookAuthority({
    auth,
    database,
    configuration: getWebhookConfiguration(endpoint),
    retained: true
  });

  assertWebhookDestination(endpoint.url);

  for (const deliveryID of input.deliveryIDs) {
    runs.push(
      await redeliverWebhookDelivery(database, auth, endpoint, { id: input.id, deliveryID })
    );
  }

  // A rejected request rolls back the runs inserted above.
  await limitWebhookManagement(workspaceID, "redeliver");

  return runs;
};

export { redeliverWebhookDelivery, redeliverWebhookDeliveries };
