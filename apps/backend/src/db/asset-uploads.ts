import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { entries } from "./entries";
import { timestamps } from "./shared";

const assetUploads = pgTable(
  "asset_uploads",
  {
    assetID: uuid("asset_id")
      .primaryKey()
      .references(() => assets.id, { onDelete: "cascade" }),
    // Null workspace identifies a user-owned upload; null entry identifies a logo/avatar upload.
    workspaceID: uuid("workspace_id"),
    entryID: uuid("entry_id"),
    byteSize: integer("byte_size").notNull(),
    expectedChecksum: varchar("expected_checksum", { length: 64 }).notNull(),
    reservedBytes: bigint("reserved_bytes", { mode: "number" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    failureReason: text("failure_reason"),
    ...timestamps
  },
  (table) => [
    check(
      "asset_uploads_entry_workspace_required",
      sql`${table.entryID} is null or ${table.workspaceID} is not null`
    ),
    foreignKey({
      name: "asset_uploads_workspace_asset_fk",
      columns: [table.workspaceID, table.assetID],
      foreignColumns: [assets.workspaceID, assets.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "asset_uploads_workspace_entry_fk",
      columns: [table.workspaceID, table.entryID],
      foreignColumns: [entries.workspaceID, entries.id]
    }).onDelete("cascade"),
    check(
      "asset_uploads_size_positive",
      sql`${table.byteSize} > 0 and ${table.reservedBytes} >= 0`
    ),
    index("asset_uploads_workspace_idx").on(table.workspaceID),
    check("asset_uploads_checksum_valid", sql`${table.expectedChecksum} ~ '^[a-f0-9]{64}$'`),
    index("asset_uploads_expiry_idx").on(table.expiresAt)
  ]
);

// No owner foreign key: storage cleanup must survive workspace and asset deletion.
const assetStorageDeletions = pgTable("asset_storage_deletions", {
  id: uuid("id").primaryKey().defaultRandom(),
  prefix: text("prefix").notNull().unique(),
  ...timestamps
});

export { assetStorageDeletions, assetUploads };
