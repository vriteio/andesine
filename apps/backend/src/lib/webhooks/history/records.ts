import {
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundDeliveryAttempts,
  type DatabaseClient
} from "@andesine/server/database";
import { loadWebhookEndpoint } from "@andesine/server/webhooks/recording";
import { type WebhookDeliveryInput } from "@andesine/contracts/webhooks";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, gt } from "drizzle-orm";

interface WebhookDeliveryLookup extends WebhookDeliveryInput {
  workspaceID: string;
  now: Date;
  lock?: boolean;
}
interface WebhookRunLookup extends WebhookDeliveryLookup {
  runID: string;
}
interface WebhookAttemptLookup extends WebhookRunLookup {
  attemptID: string;
}

type WebhookDeliveryRow = typeof outboundDeliveries.$inferSelect;
type WebhookRunRow = typeof outboundDeliveryRuns.$inferSelect;
type WebhookAttemptRow = typeof outboundDeliveryAttempts.$inferSelect;

const loadWebhookDelivery = async (database: DatabaseClient, input: WebhookDeliveryLookup) => {
  await loadWebhookEndpoint(database, {
    workspaceID: input.workspaceID,
    id: input.id,
    includeDeleted: true
  });

  const query = database
    .select()
    .from(outboundDeliveries)
    .where(
      and(
        eq(outboundDeliveries.workspaceID, toUUID(input.workspaceID)),
        eq(outboundDeliveries.endpointID, toUUID(input.id)),
        eq(outboundDeliveries.id, toUUID(input.deliveryID)),
        gt(outboundDeliveries.expiresAt, input.now)
      )
    );
  const [delivery] = await (input.lock ? query.for("update") : query);

  if (!delivery) throw new ORPCError("NOT_FOUND", { message: "Webhook delivery is unavailable" });

  return delivery;
};
// Caller has already loaded the retained delivery in the same transaction.
const loadWebhookRun = async (database: DatabaseClient, input: WebhookRunLookup) => {
  const [run] = await database
    .select()
    .from(outboundDeliveryRuns)
    .where(
      and(
        eq(outboundDeliveryRuns.workspaceID, toUUID(input.workspaceID)),
        eq(outboundDeliveryRuns.endpointID, toUUID(input.id)),
        eq(outboundDeliveryRuns.deliveryID, toUUID(input.deliveryID)),
        eq(outboundDeliveryRuns.id, toUUID(input.runID)),
        gt(outboundDeliveryRuns.expiresAt, input.now)
      )
    );

  if (!run) throw new ORPCError("NOT_FOUND", { message: "Webhook run is unavailable" });

  return run;
};
// Caller has already checked the run's delivery and endpoint ownership.
const loadWebhookAttempt = async (database: DatabaseClient, input: WebhookAttemptLookup) => {
  const [attempt] = await database
    .select()
    .from(outboundDeliveryAttempts)
    .where(
      and(
        eq(outboundDeliveryAttempts.workspaceID, toUUID(input.workspaceID)),
        eq(outboundDeliveryAttempts.runID, toUUID(input.runID)),
        eq(outboundDeliveryAttempts.id, toUUID(input.attemptID))
      )
    );

  if (!attempt) throw new ORPCError("NOT_FOUND", { message: "Webhook attempt is unavailable" });

  return attempt;
};

export { loadWebhookDelivery, loadWebhookRun, loadWebhookAttempt };
export type {
  WebhookDeliveryLookup,
  WebhookRunLookup,
  WebhookAttemptLookup,
  WebhookDeliveryRow,
  WebhookRunRow,
  WebhookAttemptRow
};
