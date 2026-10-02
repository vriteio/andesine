import { keyKindType, keyPermissionType } from "@andesine/contracts/entities";
import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

const keyPermissionEnum = pgEnum("key_permission", keyPermissionType.enum);
const keyKindEnum = pgEnum("key_kind", keyKindType.enum);

const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: keyKindEnum("kind").notNull().default("secret"),
    permissions: keyPermissionEnum("permissions")
      .array()
      .notNull()
      .default(sql`'{}'`),
    // Publishable keys only: the collection scope and the allowed browser origins.
    collectionIDs: uuid("collection_ids")
      .array()
      .notNull()
      .default(sql`'{}'`),
    allowedOrigins: text("allowed_origins")
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** Publishable keys only: the raw key, encrypted, so the app can show it again. */
    encryptedValue: text("encrypted_value"),
    prefix: varchar("prefix", { length: 12 }).notNull(),
    hash: text("hash").notNull(),
    salt: text("salt").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true })
  },
  (table) => [
    index("api_keys_prefix_idx").on(table.prefix),
    index("api_keys_workspace_id_idx").on(table.workspaceID),
    index("api_keys_expires_at_idx").on(table.expiresAt)
  ]
);

export { apiKeys, keyKindEnum, keyPermissionEnum };
