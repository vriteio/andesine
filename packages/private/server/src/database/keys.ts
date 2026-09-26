import { keyPermissionType } from "@andesine/contracts/entities";
import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

const keyPermissionEnum = pgEnum("key_permission", keyPermissionType.enum);

const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    permissions: keyPermissionEnum("permissions")
      .array()
      .notNull()
      .default(sql`'{}'`),
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

export { apiKeys, keyPermissionEnum };
