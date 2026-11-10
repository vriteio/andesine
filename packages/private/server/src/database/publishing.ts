import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { collections } from "./collections";
import { entries } from "./entries";
import { timestamps } from "./shared";
import { users } from "./users";
import { entryVersions } from "./versions";
import { workspaces } from "./workspaces";

const publishingSnapshotReasonEnum = pgEnum("publishing_snapshot_reason", [
  "initial",
  "publish",
  "unpublish",
  "channel-deletion"
]);
const publishingChannels = pgTable(
  "publishing_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    currentSnapshotID: uuid("current_snapshot_id").references(
      (): AnyPgColumn => publishingSnapshots.id,
      { onDelete: "restrict" }
    ),
    name: varchar("name", { length: 50 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    builtIn: boolean("built_in").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("publishing_channels_workspace_id_id_unique").on(table.workspaceID, table.id),
    uniqueIndex("publishing_channels_workspace_code_unique")
      .on(table.workspaceID, table.code)
      .where(sql`${table.deletedAt} is null`),
    check("publishing_channels_code_not_empty", sql`length(${table.code}) > 0`),
    check(
      "publishing_channels_built_in_code",
      sql`not ${table.builtIn} or ${table.code} = 'published'`
    )
  ]
);
const publishingSnapshots = pgTable(
  "publishing_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channelID: uuid("channel_id").notNull(),
    creatorID: uuid("creator_id").references(() => users.id, { onDelete: "set null" }),
    reason: publishingSnapshotReasonEnum("reason").notNull(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("publishing_snapshots_workspace_id_id_unique").on(table.workspaceID, table.id),
    unique("publishing_snapshots_workspace_channel_id_unique").on(
      table.workspaceID,
      table.channelID,
      table.id
    ),
    foreignKey({
      name: "publishing_snapshots_workspace_channel_fk",
      columns: [table.workspaceID, table.channelID],
      foreignColumns: [publishingChannels.workspaceID, publishingChannels.id]
    }).onDelete("restrict"),
    check(
      "publishing_snapshots_lifetime_valid",
      sql`(
        ${table.supersededAt} is null and ${table.expiresAt} is null
      ) or (
        ${table.supersededAt} is not null and ${table.expiresAt} is not null
        and ${table.expiresAt} >= ${table.supersededAt}
      )`
    ),
    index("publishing_snapshots_workspace_channel_created_idx").on(
      table.workspaceID,
      table.channelID,
      table.createdAt
    ),
    index("publishing_snapshots_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} is not null`)
  ]
);
const publishingSnapshotCollections = pgTable(
  "publishing_snapshot_collections",
  {
    workspaceID: uuid("workspace_id").notNull(),
    snapshotID: uuid("snapshot_id").notNull(),
    collectionID: uuid("collection_id").notNull(),
    parentID: uuid("parent_id"),
    name: text("name").notNull(),
    rank: varchar("rank", { length: 255 }).notNull(),
    publishedRoot: boolean("published_root").notNull().default(false)
  },
  (table) => [
    primaryKey({ columns: [table.snapshotID, table.collectionID] }),
    foreignKey({
      name: "publishing_snapshot_collections_workspace_snapshot_fk",
      columns: [table.workspaceID, table.snapshotID],
      foreignColumns: [publishingSnapshots.workspaceID, publishingSnapshots.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "publishing_snapshot_collections_workspace_collection_fk",
      columns: [table.workspaceID, table.collectionID],
      foreignColumns: [collections.workspaceID, collections.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "publishing_snapshot_collections_parent_fk",
      columns: [table.snapshotID, table.parentID],
      foreignColumns: [table.snapshotID, table.collectionID]
    }).onDelete("restrict"),
    uniqueIndex("publishing_snapshot_collections_sibling_rank_unique")
      .on(table.snapshotID, table.parentID, table.rank)
      .where(sql`${table.parentID} is not null`),
    uniqueIndex("publishing_snapshot_collections_root_rank_unique")
      .on(table.snapshotID, table.rank)
      .where(sql`${table.parentID} is null`),
    check(
      "publishing_snapshot_collections_not_own_parent",
      sql`${table.collectionID} <> ${table.parentID}`
    ),
    index("publishing_snapshot_collections_collection_idx").on(
      table.workspaceID,
      table.collectionID
    )
  ]
);
const publishingSnapshotEntries = pgTable(
  "publishing_snapshot_entries",
  {
    workspaceID: uuid("workspace_id").notNull(),
    snapshotID: uuid("snapshot_id").notNull(),
    entryID: uuid("entry_id").notNull(),
    versionID: uuid("version_id").notNull(),
    collectionID: uuid("collection_id"),
    rank: varchar("rank", { length: 255 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    publisherID: uuid("publisher_id").references(() => users.id, { onDelete: "set null" })
  },
  (table) => [
    primaryKey({ columns: [table.snapshotID, table.entryID] }),
    foreignKey({
      name: "publishing_snapshot_entries_workspace_snapshot_fk",
      columns: [table.workspaceID, table.snapshotID],
      foreignColumns: [publishingSnapshots.workspaceID, publishingSnapshots.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "publishing_snapshot_entries_workspace_entry_fk",
      columns: [table.workspaceID, table.entryID],
      foreignColumns: [entries.workspaceID, entries.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "publishing_snapshot_entries_workspace_entry_version_fk",
      columns: [table.workspaceID, table.entryID, table.versionID],
      foreignColumns: [entryVersions.workspaceID, entryVersions.entryID, entryVersions.id]
    }).onDelete("restrict"),
    foreignKey({
      name: "publishing_snapshot_entries_collection_fk",
      columns: [table.snapshotID, table.collectionID],
      foreignColumns: [
        publishingSnapshotCollections.snapshotID,
        publishingSnapshotCollections.collectionID
      ]
    }).onDelete("restrict"),
    uniqueIndex("publishing_snapshot_entries_collection_rank_unique")
      .on(table.snapshotID, table.collectionID, table.rank)
      .where(sql`${table.collectionID} is not null`),
    uniqueIndex("publishing_snapshot_entries_root_rank_unique")
      .on(table.snapshotID, table.rank)
      .where(sql`${table.collectionID} is null`),
    index("publishing_snapshot_entries_entry_idx").on(table.workspaceID, table.entryID),
    index("publishing_snapshot_entries_version_idx").on(table.workspaceID, table.versionID)
  ]
);
export {
  publishingChannels,
  publishingSnapshotCollections,
  publishingSnapshotEntries,
  publishingSnapshotReasonEnum,
  publishingSnapshots
};
