import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { timestamps } from "./shared";
import { assets } from "./assets";
import { workspaces } from "./workspaces";

const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 320 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    imageAssetID: uuid("image_asset_id").references((): AnyPgColumn => assets.id, {
      onDelete: "restrict"
    }),
    deletingAt: timestamp("deleting_at", { withTimezone: true }),
    currentWorkspaceID: uuid("current_workspace_id").references((): AnyPgColumn => workspaces.id, {
      onDelete: "set null"
    }),
    ...timestamps
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)]
);

export { users };
