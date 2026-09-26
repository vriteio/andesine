import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { timestamps } from "./shared";
import { workspaces } from "./workspaces";

const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentID: uuid("parent_id"),
    name: text("name").notNull(),
    rank: varchar("rank", { length: 255 }).notNull(),
    restricted: boolean("restricted").notNull().default(false),
    publishingEnabled: boolean("publishing_enabled").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("collections_workspace_id_id_unique").on(table.workspaceID, table.id),
    uniqueIndex("collections_sibling_rank_unique")
      .on(table.workspaceID, table.parentID, table.rank)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex("collections_single_root_unique")
      .on(table.workspaceID)
      .where(sql`${table.parentID} is null and ${table.deletedAt} is null`),
    foreignKey({
      name: "collections_workspace_parent_fk",
      columns: [table.workspaceID, table.parentID],
      foreignColumns: [table.workspaceID, table.id]
    }).onDelete("cascade"),
    check("collections_not_own_parent", sql`${table.id} <> ${table.parentID}`),
    check("collections_root_name", sql`${table.parentID} is not null or ${table.name} = '~'`),
    check(
      "collections_root_not_restricted",
      sql`${table.parentID} is not null or not ${table.restricted}`
    ),
    index("collections_workspace_parent_rank_idx").on(table.workspaceID, table.parentID, table.rank)
  ]
);

export { collections };
