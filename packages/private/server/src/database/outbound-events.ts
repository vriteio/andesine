import { type WebhookEvent, type WebhookEventName } from "@andesine/contracts/webhooks";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

const outboundEvents = pgTable(
  "outbound_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    operationID: uuid("operation_id").notNull(),
    type: text("type").$type<WebhookEventName>().notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    subject: jsonb("subject").$type<WebhookEvent["subject"]>().notNull(),
    data: jsonb("data").$type<WebhookEvent["data"]>().notNull(),
    test: boolean("test").notNull().default(false),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("outbound_events_workspace_id_unique").on(table.workspaceID, table.id),
    check("outbound_events_version_valid", sql`${table.schemaVersion} = 1`),
    check(
      "outbound_events_payload_bounded",
      sql`jsonb_typeof(${table.subject}) = 'object' and jsonb_typeof(${table.data}) = 'object' and octet_length(${table.subject}::text) <= 1024 and octet_length(${table.data}::text) <= 262144`
    ),
    index("outbound_events_workspace_created_idx").on(table.workspaceID, table.createdAt, table.id),
    index("outbound_events_operation_idx").on(table.workspaceID, table.operationID)
  ]
);
// One row per ancestor, per resource, per side. No unbounded ancestry JSON arrays.
// There are deliberately no FKs to source content: deletion/expiry must remain possible.
const outboundEventResources = pgTable(
  "outbound_event_resources",
  {
    workspaceID: uuid("workspace_id").notNull(),
    eventID: uuid("event_id").notNull(),
    resourceKind: text("resource_kind", { enum: ["entry", "collection"] }).notNull(),
    resourceID: uuid("resource_id").notNull(),
    side: text("side", { enum: ["before", "after"] }).notNull(),
    // Depth zero: the entry's parent, or the collection itself. Null denotes root scope.
    depth: integer("depth").notNull(),
    collectionID: uuid("collection_id"),
    restricted: boolean("restricted").notNull()
  },
  (table) => [
    primaryKey({
      columns: [table.eventID, table.resourceKind, table.resourceID, table.side, table.depth]
    }),
    foreignKey({
      name: "outbound_resources_event_fk",
      columns: [table.workspaceID, table.eventID],
      foreignColumns: [outboundEvents.workspaceID, outboundEvents.id]
    }).onDelete("cascade"),
    check("outbound_resources_kind_valid", sql`${table.resourceKind} in ('entry', 'collection')`),
    check("outbound_resources_side_valid", sql`${table.side} in ('before', 'after')`),
    check("outbound_resources_depth_valid", sql`${table.depth} >= 0`),
    check(
      "outbound_resources_root_valid",
      sql`${table.collectionID} is not null or not ${table.restricted}`
    ),
    index("outbound_resources_collection_idx").on(
      table.workspaceID,
      table.collectionID,
      table.eventID
    ),
    index("outbound_resources_resource_idx").on(
      table.workspaceID,
      table.resourceKind,
      table.resourceID,
      table.eventID
    )
  ]
);

export { outboundEvents, outboundEventResources };
