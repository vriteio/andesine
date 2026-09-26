import { sql } from "drizzle-orm";
import {
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
import { collections } from "./collections";
import { workspaces } from "./workspaces";

const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    collectionID: uuid("collection_id"),
    name: text("name").notNull(),
    rank: varchar("rank", { length: 255 }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("entries_workspace_id_id_unique").on(table.workspaceID, table.id),
    foreignKey({
      name: "entries_workspace_collection_fk",
      columns: [table.workspaceID, table.collectionID],
      foreignColumns: [collections.workspaceID, collections.id]
    }).onDelete("cascade"),
    uniqueIndex("entries_collection_rank_unique")
      .on(table.workspaceID, table.collectionID, table.rank)
      .where(sql`${table.collectionID} is not null and ${table.deletedAt} is null`),
    uniqueIndex("entries_root_rank_unique")
      .on(table.workspaceID, table.rank)
      .where(sql`${table.collectionID} is null and ${table.deletedAt} is null`),
    index("entries_workspace_collection_rank_idx").on(
      table.workspaceID,
      table.collectionID,
      table.rank
    )
  ]
);

export { entries };
