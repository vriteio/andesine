import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { outboundEvents } from "./outbound-events";
import { bytea } from "./shared";
import { webhookEndpointRevisions, webhookEndpoints, webhookFailureCategoryEnum } from "./webhooks";

interface LateWebhookAttemptResult {
  receivedAt: string;
  outcome: "succeeded" | "receiver_failure" | "platform_failure";
  durationMs: number;
  httpStatus: number | null;
  failureCategory: "http_status" | "network" | "timeout" | "destination_policy" | "internal" | null;
}

const outboundDeliveryStateEnum = pgEnum("outbound_delivery_state", [
  "pending",
  "in_flight",
  "succeeded",
  "failed",
  "cancelled"
]);
const outboundRunTriggerEnum = pgEnum("outbound_run_trigger", ["automatic", "manual", "test"]);
const outboundRunStopReasonEnum = pgEnum("outbound_run_stop_reason", [
  "retry_exhausted",
  "expired",
  "disabled",
  "endpoint_deleted",
  "destination_changed",
  "selection_changed",
  "access_revoked",
  "destination_policy",
  "test_completed"
]);
const outboundAttemptOutcomeEnum = pgEnum("outbound_attempt_outcome", [
  "in_flight",
  "succeeded",
  "failed",
  "unknown"
]);
const outboundDeliveries = pgTable(
  "outbound_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id").notNull(),
    endpointID: uuid("endpoint_id").notNull(),
    eventID: uuid("event_id").notNull(),
    selectedRevision: integer("selected_revision").notNull(),
    // Exact authorized UTF-8 bytes, reused for every attempt and manual replay.
    payload: bytea("payload").notNull(),
    state: outboundDeliveryStateEnum("state").notNull().default("pending"),
    retentionDays: integer("retention_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => [
    unique("outbound_deliveries_event_endpoint_unique").on(table.eventID, table.endpointID),
    // Runs reference this key so their endpoint and original expiry cannot differ.
    unique("outbound_deliveries_owner_expiry_unique").on(
      table.workspaceID,
      table.id,
      table.endpointID,
      table.expiresAt
    ),
    foreignKey({
      name: "outbound_deliveries_endpoint_fk",
      columns: [table.workspaceID, table.endpointID],
      foreignColumns: [webhookEndpoints.workspaceID, webhookEndpoints.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "outbound_deliveries_event_fk",
      columns: [table.workspaceID, table.eventID],
      foreignColumns: [outboundEvents.workspaceID, outboundEvents.id]
    }),
    foreignKey({
      name: "outbound_deliveries_revision_fk",
      columns: [table.workspaceID, table.endpointID, table.selectedRevision],
      foreignColumns: [
        webhookEndpointRevisions.workspaceID,
        webhookEndpointRevisions.endpointID,
        webhookEndpointRevisions.revision
      ]
    }),
    check(
      "outbound_deliveries_payload_bounded",
      sql`octet_length(${table.payload}) between 1 and 262144`
    ),
    check(
      "outbound_deliveries_retention_valid",
      sql`${table.retentionDays} > 0 and ${table.expiresAt} = ${table.createdAt} + ${table.retentionDays} * interval '24 hours'`
    ),
    index("outbound_deliveries_endpoint_created_idx").on(
      table.workspaceID,
      table.endpointID,
      table.createdAt,
      table.id
    ),
    index("outbound_deliveries_endpoint_state_idx").on(
      table.workspaceID,
      table.endpointID,
      table.state
    ),
    index("outbound_deliveries_expiry_idx").on(table.expiresAt, table.id)
  ]
);
const outboundDeliveryRuns = pgTable(
  "outbound_delivery_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id").notNull(),
    endpointID: uuid("endpoint_id").notNull(),
    deliveryID: uuid("delivery_id").notNull(),
    number: integer("number").notNull(),
    trigger: outboundRunTriggerEnum("trigger").notNull(),
    configurationRevision: integer("configuration_revision").notNull(),
    destinationRevision: integer("destination_revision").notNull(),
    executionGeneration: integer("execution_generation").notNull(),
    state: outboundDeliveryStateEnum("state").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    stopReason: outboundRunStopReasonEnum("stop_reason"),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    workerID: varchar("worker_id", { length: 200 })
  },
  (table) => [
    unique("outbound_runs_workspace_id_unique").on(table.workspaceID, table.id),
    unique("outbound_runs_delivery_number_unique").on(table.deliveryID, table.number),
    uniqueIndex("outbound_runs_one_active_delivery_idx")
      .on(table.deliveryID)
      .where(sql`${table.state} in ('pending', 'in_flight')`),
    uniqueIndex("outbound_runs_one_in_flight_endpoint_idx")
      .on(table.endpointID)
      .where(sql`${table.state} = 'in_flight'`),
    foreignKey({
      name: "outbound_runs_delivery_fk",
      columns: [table.workspaceID, table.deliveryID, table.endpointID, table.expiresAt],
      foreignColumns: [
        outboundDeliveries.workspaceID,
        outboundDeliveries.id,
        outboundDeliveries.endpointID,
        outboundDeliveries.expiresAt
      ]
    }).onDelete("cascade"),
    foreignKey({
      name: "outbound_runs_revision_fk",
      columns: [
        table.workspaceID,
        table.endpointID,
        table.configurationRevision,
        table.destinationRevision
      ],
      foreignColumns: [
        webhookEndpointRevisions.workspaceID,
        webhookEndpointRevisions.endpointID,
        webhookEndpointRevisions.revision,
        webhookEndpointRevisions.destinationRevision
      ]
    }),
    check(
      "outbound_runs_numbers_valid",
      sql`${table.number} > 0 and ${table.executionGeneration} > 0`
    ),
    check(
      "outbound_runs_deadline_valid",
      sql`${table.deadlineAt} > ${table.createdAt} and ${table.deadlineAt} <= ${table.expiresAt} and ${table.deadlineAt} <= ${table.createdAt} + interval '72 hours'`
    ),
    check(
      "outbound_runs_state_valid",
      sql`
      (${table.state} = 'pending' and ${table.nextAttemptAt} is not null and ${table.finishedAt} is null and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null and ${table.workerID} is null and ${table.stopReason} is null)
      or (${table.state} = 'in_flight' and ${table.nextAttemptAt} is null and ${table.finishedAt} is null and ${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null and ${table.workerID} is not null and ${table.stopReason} is null)
      or (${table.state} in ('succeeded', 'failed', 'cancelled') and ${table.finishedAt} is not null and ${table.nextAttemptAt} is null and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null and ${table.workerID} is null)
    `
    ),
    check(
      "outbound_runs_times_valid",
      sql`(${table.nextAttemptAt} is null or (${table.nextAttemptAt} >= ${table.createdAt} and ${table.nextAttemptAt} < ${table.deadlineAt})) and (${table.finishedAt} is null or ${table.finishedAt} >= ${table.createdAt}) and (${table.leaseExpiresAt} is null or ${table.leaseExpiresAt} > ${table.createdAt})`
    ),
    index("outbound_runs_due_idx")
      .on(table.nextAttemptAt, table.id)
      .where(sql`${table.state} = 'pending'`),
    index("outbound_runs_lease_expiry_idx")
      .on(table.leaseExpiresAt, table.id)
      .where(sql`${table.state} = 'in_flight'`),
    index("outbound_runs_deadline_idx")
      .on(table.deadlineAt, table.id)
      .where(sql`${table.state} in ('pending', 'in_flight')`),
    index("outbound_runs_destination_idx").on(
      table.workspaceID,
      table.endpointID,
      table.destinationRevision,
      table.state
    ),
    index("outbound_runs_revision_idx").on(
      table.workspaceID,
      table.endpointID,
      table.configurationRevision
    )
  ]
);
const outboundDeliveryAttempts = pgTable(
  "outbound_delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id").notNull(),
    runID: uuid("run_id").notNull(),
    number: integer("number").notNull(),
    leaseToken: uuid("lease_token").notNull(),
    workerID: varchar("worker_id", { length: 200 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    outcome: outboundAttemptOutcomeEnum("outcome").notNull().default("in_flight"),
    httpStatus: integer("http_status"),
    failureCategory: webhookFailureCategoryEnum("failure_category"),
    // First observed late result only; never replace the original attempt outcome.
    lateResult: jsonb("late_result").$type<LateWebhookAttemptResult>()
  },
  (table) => [
    unique("outbound_attempts_run_number_unique").on(table.runID, table.number),
    unique("outbound_attempts_lease_unique").on(table.leaseToken),
    uniqueIndex("outbound_attempts_one_in_flight_idx")
      .on(table.runID)
      .where(sql`${table.outcome} = 'in_flight'`),
    foreignKey({
      name: "outbound_attempts_run_fk",
      columns: [table.workspaceID, table.runID],
      foreignColumns: [outboundDeliveryRuns.workspaceID, outboundDeliveryRuns.id]
    }).onDelete("cascade"),
    check(
      "outbound_attempts_late_result_bounded",
      sql`${table.lateResult} is null or (jsonb_typeof(${table.lateResult}) = 'object' and octet_length(${table.lateResult}::text) <= 512)`
    ),
    check(
      "outbound_attempts_numbers_valid",
      sql`${table.number} > 0 and (${table.durationMs} is null or ${table.durationMs} >= 0) and (${table.httpStatus} is null or ${table.httpStatus} between 100 and 599)`
    ),
    check(
      "outbound_attempts_times_valid",
      sql`(${table.outcome} = 'in_flight' and ${table.finishedAt} is null and ${table.durationMs} is null and ${table.httpStatus} is null and ${table.failureCategory} is null) or (${table.outcome} <> 'in_flight' and ${table.finishedAt} is not null and ${table.finishedAt} >= ${table.startedAt})`
    ),
    check(
      "outbound_attempts_result_valid",
      sql`
      (${table.outcome} = 'succeeded' and ${table.httpStatus} is not null and ${table.httpStatus} between 200 and 299 and ${table.failureCategory} is null)
      or (${table.outcome} = 'failed' and ${table.failureCategory} is not null and (${table.httpStatus} is null or ${table.httpStatus} not between 200 and 299))
      or (${table.outcome} in ('unknown', 'in_flight') and ${table.httpStatus} is null and ${table.failureCategory} is null)
    `
    )
  ]
);

export {
  outboundDeliveries,
  outboundDeliveryRuns,
  outboundDeliveryAttempts,
  outboundDeliveryStateEnum,
  outboundRunTriggerEnum,
  outboundRunStopReasonEnum,
  outboundAttemptOutcomeEnum
};
export type { LateWebhookAttemptResult };
