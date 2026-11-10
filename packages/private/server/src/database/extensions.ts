import {
  extensionDisabledReasonType,
  extensionPermissionType,
  type ExtensionBackendKey,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions";
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
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { memberships } from "./memberships";
import { bytea, timestamps } from "./shared";
import { workspaces } from "./workspaces";

const extensionPermissionEnum = pgEnum("extension_permission", extensionPermissionType.enum);
// "manual" is derived from the desired state, so only system reasons are stored.
const extensionDisabledReasonEnum = pgEnum(
  "extension_disabled_reason",
  extensionDisabledReasonType.exclude(["manual"]).enum
);
const extensionRegistryVersions = pgTable(
  "extension_registry_versions",
  {
    // The registry URL that published the record.
    source: varchar("source", { length: 2048 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    manifest: jsonb("manifest").$type<ExtensionVersionManifest>().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    replacementVersion: varchar("replacement_version", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.name, table.version] }),
    check(
      "extension_registry_versions_revocation_valid",
      sql`(${table.revokedAt} is null) = (${table.revocationReason} is null) and (${table.replacementVersion} is null or ${table.revokedAt} is not null)`
    )
  ]
);
const extensionRegistryKeys = pgTable(
  "extension_registry_keys",
  {
    source: varchar("source", { length: 2048 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    kid: varchar("kid", { length: 64 }).notNull(),
    // Null only for key IDs that were revoked before this instance saw them.
    key: jsonb("key").$type<ExtensionBackendKey>(),
    current: boolean("current").notNull().default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    primaryKey({ columns: [table.name, table.kid] }),
    check(
      "extension_registry_keys_state_valid",
      sql`(${table.key} is not null or ${table.revokedAt} is not null) and not (${table.current} and ${table.revokedAt} is not null)`
    )
  ]
);
const extensions = pgTable(
  "extensions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    version: varchar("version", { length: 64 }).notNull(),
    development: boolean("development").notNull().default(false),
    // The member who develops a development extension; only they see and run it.
    developerID: uuid("developer_id"),
    // The approved grant: permissions, backend URL, and frontend request URLs.
    permissions: extensionPermissionEnum("permissions")
      .array()
      .notNull()
      .default(sql`'{}'`),
    backendURL: varchar("backend_url", { length: 2048 }),
    requests: text("requests")
      .array()
      .notNull()
      .default(sql`'{}'`),
    enabled: boolean("enabled").notNull().default(true),
    disabledReason: extensionDisabledReasonEnum("disabled_reason"),
    revision: integer("revision").notNull().default(1),
    generation: integer("generation").notNull().default(1),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("extensions_workspace_id_unique").on(table.workspaceID, table.id),
    uniqueIndex("extensions_workspace_name_unique")
      .on(table.workspaceID, table.name)
      .where(sql`${table.uninstalledAt} is null`),
    index("extensions_version_idx").on(table.name, table.version),
    check("extensions_counters_valid", sql`${table.revision} > 0 and ${table.generation} > 0`),
    check(
      "extensions_tombstone_valid",
      sql`${table.uninstalledAt} is null or not ${table.enabled}`
    ),
    check(
      "extensions_development_valid",
      sql`${table.development} = (${table.developerID} is not null)`
    ),
    foreignKey({
      name: "extensions_developer_fk",
      columns: [table.workspaceID, table.developerID],
      foreignColumns: [memberships.workspaceID, memberships.id]
    }).onDelete("cascade")
  ]
);
/** The current build of a development extension; `extensions.version` names it. */
const extensionDevelopmentVersions = pgTable("extension_development_versions", {
  extensionID: uuid("extension_id")
    .primaryKey()
    .references(() => extensions.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 64 }).notNull(),
  // Artifact URLs point to the instance; the manifest's backend keys are development keys.
  manifest: jsonb("manifest").$type<ExtensionVersionManifest>().notNull(),
  frontend: text("frontend").notNull(),
  styles: text("styles"),
  icons: text("icons"),
  ...timestamps
});
const extensionElementViews = pgTable(
  "extension_element_views",
  {
    extensionID: uuid("extension_id")
      .notNull()
      .references(() => extensions.id, { onDelete: "cascade" }),
    viewID: varchar("view_id", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull(),
    ...timestamps
  },
  (table) => [primaryKey({ columns: [table.extensionID, table.viewID] })]
);
const extensionActiveViews = pgTable(
  "extension_active_views",
  {
    workspaceID: uuid("workspace_id").notNull(),
    selector: varchar("selector", { length: 100 }).notNull(),
    extensionID: uuid("extension_id").notNull(),
    viewID: varchar("view_id", { length: 64 }).notNull()
  },
  (table) => [
    primaryKey({ columns: [table.workspaceID, table.selector] }),
    foreignKey({
      name: "extension_active_views_extension_fk",
      columns: [table.workspaceID, table.extensionID],
      foreignColumns: [extensions.workspaceID, extensions.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "extension_active_views_view_fk",
      columns: [table.extensionID, table.viewID],
      foreignColumns: [extensionElementViews.extensionID, extensionElementViews.viewID]
    }).onDelete("cascade"),
    check(
      "extension_active_views_selector_valid",
      sql`${table.selector} = lower(${table.selector})`
    )
  ]
);
const extensionStorage = pgTable(
  "extension_storage",
  {
    extensionID: uuid("extension_id")
      .notNull()
      .references(() => extensions.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 256 }).notNull(),
    value: jsonb("value").notNull(),
    size: integer("size").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.extensionID, table.key] }),
    check("extension_storage_size_valid", sql`${table.size} > 0`)
  ]
);
const extensionConfigurations = pgTable(
  "extension_configurations",
  {
    extensionID: uuid("extension_id")
      .primaryKey()
      .references(() => extensions.id, { onDelete: "cascade" }),
    // Non-secret values only; secret values are in extension_secrets.
    values: jsonb("values")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    revision: integer("revision").notNull().default(1),
    ...timestamps
  },
  (table) => [check("extension_configurations_revision_valid", sql`${table.revision} > 0`)]
);
const extensionSecrets = pgTable(
  "extension_secrets",
  {
    extensionID: uuid("extension_id")
      .notNull()
      .references(() => extensions.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    // Versioned AES-GCM envelope from the application encryption key.
    ciphertext: bytea("ciphertext").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.extensionID, table.key] })]
);

export {
  extensionPermissionEnum,
  extensionDisabledReasonEnum,
  extensionRegistryVersions,
  extensionRegistryKeys,
  extensions,
  extensionElementViews,
  extensionActiveViews,
  extensionStorage,
  extensionConfigurations,
  extensionSecrets,
  extensionDevelopmentVersions
};
