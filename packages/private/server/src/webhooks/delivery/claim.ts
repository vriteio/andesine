import {
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundDeliveryAttempts,
  type DatabaseTransaction,
  type Database
} from "@andesine/server/database";
import { generateUUID } from "../../primitives/id";
import {
  toWebhookID,
  toWebhookAttemptID,
  toWebhookDeliveryID,
  toWebhookEventID,
  toWebhookRunID,
  toWorkspaceID
} from "@andesine/contracts/primitives";
import { and, count, eq, max, sql } from "drizzle-orm";
import { getDeliveryAccessStopReason } from "./access";
import {
  lockDeliveryRun,
  getDeliveryTime,
  type DeliveryRunIdentity,
  type LockedDeliveryRun
} from "./locking";
import { getDeliveryStopReason, stopDeliveryRun } from "./state";

interface ClaimDeliveryRunInput extends DeliveryRunIdentity {
  workerID: string;
  globalConcurrency?: number;
  workspaceConcurrency?: number;
}
interface ClaimedDeliveryRun extends DeliveryRunIdentity {
  endpointID: string;
  deliveryID: string;
  eventID: string;
  attemptID: string;
  attemptNumber: number;
  destinationRevision: number;
  executionGeneration: number;
  payload: Buffer;
  leaseToken: string;
  leaseExpiresAt: Date;
  deadlineAt: Date;
}
interface DeliveryLeaseIdentity extends DeliveryRunIdentity {
  leaseToken: string;
}

const WEBHOOK_LEASE_MS = 60_000;
const claimDeliveryRun = async (
  database: Database,
  input: ClaimDeliveryRunInput
): Promise<ClaimedDeliveryRun | null> => {
  const globalConcurrency = input.globalConcurrency ?? 16;
  const workspaceConcurrency = input.workspaceConcurrency ?? 4;

  if (
    !input.workerID ||
    input.workerID.length > 200 ||
    !Number.isSafeInteger(globalConcurrency) ||
    globalConcurrency < 1 ||
    !Number.isSafeInteger(workspaceConcurrency) ||
    workspaceConcurrency < 1
  ) {
    throw new Error("Invalid webhook worker or concurrency limits");
  }

  return database.transaction(async (transaction) => {
    // Serialize only claim admission across replicas; never hold this lock over I/O.
    // Wait instead of skipping, so concurrent jobs are not dropped until the next scan.
    await transaction.execute(sql`
      select pg_advisory_xact_lock(hashtext('andesine:webhooks:claims'))
    `);

    const context = await lockDeliveryRun(transaction, input);

    if (!context || context.run.state !== "pending") return null;

    const now = await getDeliveryTime(transaction);
    const reason =
      getDeliveryStopReason(context, now) ??
      (await getDeliveryAccessStopReason(transaction, context));

    if (reason) {
      await stopDeliveryRun(transaction, context, reason, now);
      return null;
    }

    if (!context.run.nextAttemptAt || context.run.nextAttemptAt > now) return null;

    const [active] = await transaction
      .select({
        global: count(),
        workspace:
          sql<number>`count(*) filter (where ${outboundDeliveryRuns.workspaceID} = ${context.run.workspaceID})`.mapWith(
            Number
          ),
        endpoint:
          sql<number>`count(*) filter (where ${outboundDeliveryRuns.endpointID} = ${context.run.endpointID})`.mapWith(
            Number
          )
      })
      .from(outboundDeliveryRuns)
      .where(eq(outboundDeliveryRuns.state, "in_flight"));

    const atCapacity =
      active.global >= globalConcurrency ||
      active.workspace >= workspaceConcurrency ||
      active.endpoint > 0;

    if (atCapacity) return null;

    const [previous] = await transaction
      .select({ number: max(outboundDeliveryAttempts.number) })
      .from(outboundDeliveryAttempts)
      .where(eq(outboundDeliveryAttempts.runID, context.run.id));
    const attemptID = generateUUID();
    const leaseToken = generateUUID();
    const number = (previous.number ?? 0) + 1;
    const startedAt = await getDeliveryTime(transaction);

    if (context.run.trigger === "test" && number > 1) {
      await stopDeliveryRun(transaction, context, "test_completed", startedAt);
      return null;
    }

    if (context.run.deadlineAt <= startedAt) return null;

    const leaseExpiresAt = new Date(
      Math.min(+startedAt + WEBHOOK_LEASE_MS, +context.run.deadlineAt)
    );

    await transaction
      .update(outboundDeliveryRuns)
      .set({
        state: "in_flight",
        nextAttemptAt: null,
        leaseToken,
        leaseExpiresAt,
        workerID: input.workerID
      })
      .where(eq(outboundDeliveryRuns.id, context.run.id));
    await transaction
      .update(outboundDeliveries)
      .set({ state: "in_flight" })
      .where(eq(outboundDeliveries.id, context.delivery.id));
    await transaction.insert(outboundDeliveryAttempts).values({
      id: attemptID,
      workspaceID: context.run.workspaceID,
      runID: context.run.id,
      number,
      leaseToken,
      workerID: input.workerID,
      startedAt,
      outcome: "in_flight"
    });

    return {
      workspaceID: toWorkspaceID(context.run.workspaceID),
      runID: toWebhookRunID(context.run.id),
      endpointID: toWebhookID(context.run.endpointID),
      deliveryID: toWebhookDeliveryID(context.delivery.id),
      eventID: toWebhookEventID(context.delivery.eventID),
      attemptID: toWebhookAttemptID(attemptID),
      attemptNumber: number,
      destinationRevision: context.run.destinationRevision,
      executionGeneration: context.run.executionGeneration,
      payload: context.delivery.payload,
      leaseToken,
      leaseExpiresAt,
      deadlineAt: context.run.deadlineAt
    };
  });
};
// Dispatch requires an eligible endpoint and the current lease. Completion
// uses its own lease check so endpoint changes do not hide an observed HTTP result.
const lockDeliveryLease = async (
  database: DatabaseTransaction,
  input: DeliveryLeaseIdentity
): Promise<LockedDeliveryRun | null> => {
  const context = await lockDeliveryRun(database, input, false);
  const now = await getDeliveryTime(database);
  const leaseActive =
    context?.run.state === "in_flight" &&
    context.run.leaseToken === input.leaseToken &&
    Boolean(context.run.leaseExpiresAt) &&
    context.run.leaseExpiresAt! > now &&
    !getDeliveryStopReason(context, now);

  if (!context || !leaseActive) return null;

  const [attempt] = await database
    .select({ id: outboundDeliveryAttempts.id })
    .from(outboundDeliveryAttempts)
    .where(
      and(
        eq(outboundDeliveryAttempts.runID, context.run.id),
        eq(outboundDeliveryAttempts.leaseToken, input.leaseToken),
        eq(outboundDeliveryAttempts.outcome, "in_flight")
      )
    )
    .for("update");

  return attempt ? context : null;
};

export { claimDeliveryRun, lockDeliveryLease, WEBHOOK_LEASE_MS };
export type { ClaimDeliveryRunInput, ClaimedDeliveryRun, DeliveryLeaseIdentity };
