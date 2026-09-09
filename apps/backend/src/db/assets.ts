import { sql } from "drizzle-orm";
import {
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
import { entries } from "./entries";
import { timestamps } from "./shared";
import { users } from "./users";
import { entryVersions } from "./versions";
import { workspaces } from "./workspaces";

const assetStatusEnum = pgEnum("asset_status", [
  "pending",
  "processing",
  "ready",
  "failed",
  "deleting"
]);
// The existing database enum includes source; new uploads and delivery use only display/thumbnail.
const assetFileVariantEnum = pgEnum("asset_file_variant", ["source", "thumbnail", "display"]);
const assetFileFormatEnum = pgEnum("asset_file_format", ["jpeg", "png", "webp"]);

const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Owner deletion must schedule file cleanup before removing the asset records.
    workspaceID: uuid("workspace_id").references(() => workspaces.id, { onDelete: "restrict" }),
    userID: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
    filename: varchar("filename", { length: 255 }).notNull(),
    status: assetStatusEnum("status").notNull().default("pending"),
    unreferencedAt: timestamp("unreferenced_at", { withTimezone: true }),
    // Hash of the uploaded bytes, calculated by the server before image processing.
    sourceChecksum: varchar("source_checksum", { length: 64 }),
    ...timestamps
  },
  (table) => [
    unique("assets_workspace_id_id_unique").on(table.workspaceID, table.id),
    unique("assets_user_id_id_unique").on(table.userID, table.id),
    check(
      "assets_single_owner",
      sql`(${table.workspaceID} is not null) <> (${table.userID} is not null)`
    ),
    check("assets_filename_not_empty", sql`length(trim(${table.filename})) > 0`),
    check(
      "assets_source_checksum_valid",
      sql`${table.sourceChecksum} is null or ${table.sourceChecksum} ~ '^[a-f0-9]{64}$'`
    ),
    check(
      "assets_ready_checksum_required",
      sql`${table.status} <> 'ready' or ${table.sourceChecksum} is not null`
    ),
    // Equal bytes do not imply equal access. Duplicate detection must check entry permissions.
    index("assets_workspace_checksum_idx")
      .on(table.workspaceID, table.sourceChecksum)
      .where(sql`${table.sourceChecksum} is not null`),
    index("assets_status_updated_idx").on(table.status, table.updatedAt)
  ]
);

const assetAnalysisStatusEnum = pgEnum("asset_analysis_status", [
  "pending",
  "processing",
  "ready",
  "failed"
]);
const assetAnalyses = pgTable(
  "asset_analyses",
  {
    assetID: uuid("asset_id")
      .primaryKey()
      .references(() => assets.id, { onDelete: "cascade" }),
    status: assetAnalysisStatusEnum("status").notNull().default("pending"),
    description: text("description"),
    extractedText: text("extracted_text"),
    analysisModel: text("analysis_model"),
    embedding: jsonb("embedding").$type<number[]>(),
    embeddingModel: text("embedding_model"),
    embeddingDimensions: integer("embedding_dimensions"),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    // Also acts as the lease deadline while a worker is processing the image.
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (table) => [
    index("asset_analyses_pending_idx")
      .on(table.nextAttemptAt)
      .where(sql`${table.status} in ('pending', 'processing')`),
    check("asset_analyses_attempts_valid", sql`${table.attempts} >= 0`),
    check(
      "asset_analyses_ready_fields",
      sql`${table.status} <> 'ready' or (
    ${table.description} is not null and ${table.extractedText} is not null
    and ${table.analysisModel} is not null and ${table.embedding} is not null
    and ${table.embeddingModel} is not null and ${table.embeddingDimensions} is not null
    and ${table.embeddingDimensions} > 0
    and jsonb_array_length(${table.embedding}) = ${table.embeddingDimensions}
  )`
    )
  ]
);

// One row per physical processed file. Small display files also serve as thumbnails.
const assetFiles = pgTable(
  "asset_files",
  {
    assetID: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    variant: assetFileVariantEnum("variant").notNull(),
    objectKey: text("object_key").notNull(),
    format: assetFileFormatEnum("format").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    ...timestamps
  },
  (table) => [
    primaryKey({ columns: [table.assetID, table.variant] }),
    unique("asset_files_object_key_unique").on(table.objectKey),
    check("asset_files_object_key_not_empty", sql`length(trim(${table.objectKey})) > 0`),
    check("asset_files_byte_size_positive", sql`${table.byteSize} > 0`),
    check("asset_files_dimensions_positive", sql`${table.width} > 0 and ${table.height} > 0`)
  ]
);

// One row per current entry/asset pair, even when multiple blocks use the same image.
const entryAssets = pgTable(
  "entry_assets",
  {
    workspaceID: uuid("workspace_id").notNull(),
    entryID: uuid("entry_id").notNull(),
    assetID: uuid("asset_id").notNull(),
    // Null confirms document use; a timestamp protects an authorized insertion until save.
    pendingUntil: timestamp("pending_until", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.entryID, table.assetID] }),
    foreignKey({
      name: "entry_assets_workspace_entry_fk",
      columns: [table.workspaceID, table.entryID],
      foreignColumns: [entries.workspaceID, entries.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "entry_assets_workspace_asset_fk",
      columns: [table.workspaceID, table.assetID],
      foreignColumns: [assets.workspaceID, assets.id]
    }).onDelete("restrict"),
    index("entry_assets_workspace_asset_idx").on(table.workspaceID, table.assetID),
    index("entry_assets_pending_until_idx")
      .on(table.pendingUntil)
      .where(sql`${table.pendingUntil} is not null`)
  ]
);

// Version references retain files independently of the current document and publication state.
const entryVersionAssets = pgTable(
  "entry_version_assets",
  {
    workspaceID: uuid("workspace_id").notNull(),
    entryID: uuid("entry_id").notNull(),
    versionID: uuid("version_id").notNull(),
    assetID: uuid("asset_id").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.versionID, table.assetID] }),
    foreignKey({
      name: "entry_version_assets_workspace_entry_version_fk",
      columns: [table.workspaceID, table.entryID, table.versionID],
      foreignColumns: [entryVersions.workspaceID, entryVersions.entryID, entryVersions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "entry_version_assets_workspace_asset_fk",
      columns: [table.workspaceID, table.assetID],
      foreignColumns: [assets.workspaceID, assets.id]
    }).onDelete("restrict"),
    index("entry_version_assets_workspace_asset_idx").on(table.workspaceID, table.assetID),
    index("entry_version_assets_workspace_entry_idx").on(table.workspaceID, table.entryID)
  ]
);

export {
  assetAnalyses,
  assetAnalysisStatusEnum,
  assetFileFormatEnum,
  assetFiles,
  assetFileVariantEnum,
  assets,
  assetStatusEnum,
  entryAssets,
  entryVersionAssets
};
