import {
  outboundDeliveryRuns,
  outboundDeliveryAttempts,
  type outboundEvents,
  type DatabaseClient
} from "@andesine/server/database";
import {
  type WebhookDelivery,
  type WebhookRun,
  type WebhookAttempt
} from "@andesine/contracts/webhooks";
import {
  toWebhookID,
  toWebhookDeliveryID,
  toWebhookEventID,
  toWebhookRunID,
  toWebhookAttemptID
} from "@andesine/contracts/primitives";
import { count, desc, eq, inArray } from "drizzle-orm";
import type { WebhookDeliveryRow, WebhookRunRow, WebhookAttemptRow } from "./records";

interface WebhookDeliveryMetadata {
  delivery: Omit<WebhookDeliveryRow, "payload">;
  event: Pick<typeof outboundEvents.$inferSelect, "type" | "occurredAt" | "test">;
}

const describeWebhookRun = (run: WebhookRunRow, attemptCount = 0): WebhookRun => ({
  id: toWebhookRunID(run.id),
  deliveryID: toWebhookDeliveryID(run.deliveryID),
  number: run.number,
  trigger: run.trigger,
  destinationRevision: run.destinationRevision,
  state: run.state,
  createdAt: run.createdAt.toISOString(),
  deadlineAt: run.deadlineAt.toISOString(),
  finishedAt: run.finishedAt?.toISOString() ?? null,
  nextAttemptAt: run.nextAttemptAt?.toISOString() ?? null,
  attemptCount,
  stopReason: run.stopReason
});
const describeWebhookRuns = async (
  database: DatabaseClient,
  runs: WebhookRunRow[]
): Promise<WebhookRun[]> => {
  if (!runs.length) return [];

  const totals = await database
    .select({ runID: outboundDeliveryAttempts.runID, count: count() })
    .from(outboundDeliveryAttempts)
    .where(
      inArray(
        outboundDeliveryAttempts.runID,
        runs.map(({ id }) => id)
      )
    )
    .groupBy(outboundDeliveryAttempts.runID);
  const counts = new Map(totals.map((row) => [row.runID, row.count]));

  return runs.map((run) => describeWebhookRun(run, counts.get(run.id) ?? 0));
};
const describeWebhookAttempt = (attempt: WebhookAttemptRow): WebhookAttempt => ({
  id: toWebhookAttemptID(attempt.id),
  runID: toWebhookRunID(attempt.runID),
  number: attempt.number,
  startedAt: attempt.startedAt.toISOString(),
  finishedAt: attempt.finishedAt?.toISOString() ?? null,
  durationMs: attempt.durationMs,
  outcome: attempt.outcome,
  httpStatus: attempt.httpStatus,
  failureCategory: attempt.failureCategory,
  lateResult: attempt.lateResult
});
const describeWebhookDeliveries = async (
  database: DatabaseClient,
  rows: WebhookDeliveryMetadata[]
): Promise<WebhookDelivery[]> => {
  if (!rows.length) return [];

  const ids = rows.map(({ delivery }) => delivery.id);
  const runs = await database
    .selectDistinctOn([outboundDeliveryRuns.deliveryID])
    .from(outboundDeliveryRuns)
    .where(inArray(outboundDeliveryRuns.deliveryID, ids))
    .orderBy(outboundDeliveryRuns.deliveryID, desc(outboundDeliveryRuns.number));
  const totals = await database
    .select({ deliveryID: outboundDeliveryRuns.deliveryID, count: count() })
    .from(outboundDeliveryAttempts)
    .innerJoin(outboundDeliveryRuns, eq(outboundDeliveryRuns.id, outboundDeliveryAttempts.runID))
    .where(inArray(outboundDeliveryRuns.deliveryID, ids))
    .groupBy(outboundDeliveryRuns.deliveryID);
  const attempts = await database
    .selectDistinctOn([outboundDeliveryRuns.deliveryID], {
      deliveryID: outboundDeliveryRuns.deliveryID,
      httpStatus: outboundDeliveryAttempts.httpStatus,
      failureCategory: outboundDeliveryAttempts.failureCategory
    })
    .from(outboundDeliveryAttempts)
    .innerJoin(outboundDeliveryRuns, eq(outboundDeliveryRuns.id, outboundDeliveryAttempts.runID))
    .where(inArray(outboundDeliveryRuns.deliveryID, ids))
    .orderBy(
      outboundDeliveryRuns.deliveryID,
      desc(outboundDeliveryRuns.number),
      desc(outboundDeliveryAttempts.number)
    );
  const current = new Map(runs.map((run) => [run.deliveryID, run]));
  const counts = new Map(totals.map((row) => [row.deliveryID, row.count]));
  const latest = new Map(attempts.map((attempt) => [attempt.deliveryID, attempt]));

  return rows.map(({ delivery, event }) => {
    const run = current.get(delivery.id);
    const attempt = latest.get(delivery.id);

    return {
      id: toWebhookDeliveryID(delivery.id),
      endpointID: toWebhookID(delivery.endpointID),
      eventID: toWebhookEventID(delivery.eventID),
      type: event.type,
      occurredAt: event.occurredAt.toISOString(),
      test: event.test,
      state: delivery.state,
      selectedRevision: delivery.selectedRevision,
      createdAt: delivery.createdAt.toISOString(),
      expiresAt: delivery.expiresAt.toISOString(),
      retentionDays: delivery.retentionDays,
      attemptCount: counts.get(delivery.id) ?? 0,
      currentRunID: run ? toWebhookRunID(run.id) : null,
      nextAttemptAt: run?.nextAttemptAt?.toISOString() ?? null,
      lastHTTPStatus: attempt?.httpStatus ?? null,
      lastFailureCategory: attempt?.failureCategory ?? null
    };
  });
};

export {
  describeWebhookRun,
  describeWebhookRuns,
  describeWebhookAttempt,
  describeWebhookDeliveries
};
