import { type WebhookConfiguration, type WebhookEventName } from "@andesine/contracts/webhooks";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { bytea, timestamps } from "./shared";
import { workspaces } from "./workspaces";

const webhookFailureCategoryEnum = pgEnum("webhook_failure_category", [
  "http_status",
  "timeout",
  "network",
  "destination_policy",
  "internal"
]);
const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    eventTypes: text("event_types").array().$type<WebhookEventName[]>().notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    collections: jsonb("collections").$type<WebhookConfiguration["collections"]>().notNull(),
    channels: jsonb("channels").$type<WebhookConfiguration["channels"]>().notNull(),
    restrictedContent: boolean("restricted_content").notNull().default(false),
    revision: integer("revision").notNull().default(1),
    destinationRevision: integer("destination_revision").notNull().default(1),
    executionGeneration: integer("execution_generation").notNull().default(1),
    // Versioned AES-GCM envelopes, bound to workspace/endpoint/destination identity.
    // No creator/key foreign key: the export scope belongs to the workspace.
    currentSecretCiphertext: bytea("current_secret_ciphertext"),
    previousSecretCiphertext: bytea("previous_secret_ciphertext"),
    previousSecretExpiresAt: timestamp("previous_secret_expires_at", { withTimezone: true }),
    secretRotatedAt: timestamp("secret_rotated_at", { withTimezone: true }).notNull().defaultNow(),
    disabledReason: text("disabled_reason", { enum: ["manual", "failures"] }).default("manual"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    firstFailureAt: timestamp("first_failure_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastFailureCategory: webhookFailureCategoryEnum("last_failure_category"),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("webhook_endpoints_workspace_id_unique").on(table.workspaceID, table.id),
    check("webhook_endpoints_name_valid", sql`length(btrim(${table.name})) > 0`),
    check("webhook_endpoints_version_valid", sql`${table.schemaVersion} = 1`),
    check(
      "webhook_endpoints_revisions_valid",
      sql`${table.revision} >= ${table.destinationRevision} and ${table.destinationRevision} > 0 and ${table.executionGeneration} > 0`
    ),
    check("webhook_endpoints_selection_valid", sql`cardinality(${table.eventTypes}) > 0`),
    check(
      "webhook_endpoints_disabled_valid",
      sql`(${table.enabled} and ${table.disabledReason} is null) or (not ${table.enabled} and ${table.disabledReason} is not null and ${table.disabledReason} in ('manual', 'failures'))`
    ),
    check(
      "webhook_endpoints_secrets_valid",
      sql`(${table.deletedAt} is null and ${table.currentSecretCiphertext} is not null and octet_length(${table.currentSecretCiphertext}) > 0) or (${table.deletedAt} is not null and not ${table.enabled} and ${table.currentSecretCiphertext} is null and ${table.previousSecretCiphertext} is null)`
    ),
    check(
      "webhook_endpoints_overlap_valid",
      sql`(${table.previousSecretCiphertext} is null and ${table.previousSecretExpiresAt} is null) or (${table.previousSecretCiphertext} is not null and octet_length(${table.previousSecretCiphertext}) > 0 and ${table.previousSecretExpiresAt} is not null and ${table.previousSecretExpiresAt} > ${table.secretRotatedAt})`
    ),
    check(
      "webhook_endpoints_failure_streak_valid",
      sql`(${table.consecutiveFailures} = 0 and ${table.firstFailureAt} is null) or (${table.consecutiveFailures} > 0 and ${table.firstFailureAt} is not null)`
    ),
    index("webhook_endpoints_workspace_created_idx").on(
      table.workspaceID,
      table.createdAt,
      table.id
    ),
    index("webhook_endpoints_failure_period_idx")
      .on(table.firstFailureAt)
      .where(
        sql`${table.enabled} and ${table.deletedAt} is null and ${table.firstFailureAt} is not null`
      ),
    index("webhook_endpoints_secret_expiry_idx")
      .on(table.previousSecretExpiresAt)
      .where(sql`${table.previousSecretExpiresAt} is not null`),
    index("webhook_endpoints_deleted_idx")
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null`)
  ]
);
const webhookEndpointRevisions = pgTable(
  "webhook_endpoint_revisions",
  {
    workspaceID: uuid("workspace_id").notNull(),
    endpointID: uuid("endpoint_id").notNull(),
    revision: integer("revision").notNull(),
    destinationRevision: integer("destination_revision").notNull(),
    configuration: jsonb("configuration").$type<WebhookConfiguration>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.workspaceID, table.endpointID, table.revision] }),
    unique("webhook_revisions_destination_unique").on(
      table.workspaceID,
      table.endpointID,
      table.revision,
      table.destinationRevision
    ),
    foreignKey({
      name: "webhook_revisions_endpoint_fk",
      columns: [table.workspaceID, table.endpointID],
      foreignColumns: [webhookEndpoints.workspaceID, webhookEndpoints.id]
    }).onDelete("cascade"),
    check(
      "webhook_revisions_numbers_valid",
      sql`${table.revision} >= ${table.destinationRevision} and ${table.destinationRevision} > 0`
    )
  ]
);

export { webhookEndpoints, webhookEndpointRevisions, webhookFailureCategoryEnum };
