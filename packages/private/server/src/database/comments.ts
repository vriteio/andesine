import type { ContentNode } from "@andesine/document";
import { eq, isNull, or, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";
import { entries } from "./entries";
import { memberships } from "./memberships";
import { timestamps } from "./shared";

interface CommentSuggestionData {
  blockIDs: string[];
  after: string | null;
  base: ContentNode[];
  blocks: ContentNode[];
  /** A suggested entry title; its block patch is empty. */
  title?: { base: string; suggested: string };
}

const commentThreads = pgTable(
  "comment_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id").notNull(),
    entryID: uuid("entry_id").notNull(),
    blockID: text("block_id"),
    anchorStart: text("anchor_start"),
    anchorEnd: text("anchor_end"),
    quote: text("quote"),
    suggestion: jsonb("suggestion").$type<CommentSuggestionData>(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    authorID: uuid("author_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByID: uuid("resolved_by_id"),
    /** Resolved as its suggestion couldn't apply; it reopens once it applies again. */
    autoResolved: boolean("auto_resolved").notNull().default(false),
    ...timestamps
  },
  (table) => [
    unique("comment_threads_workspace_id_id_unique").on(table.workspaceID, table.id),
    foreignKey({
      name: "comment_threads_workspace_entry_fk",
      columns: [table.workspaceID, table.entryID],
      foreignColumns: [entries.workspaceID, entries.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "comment_threads_author_fk",
      columns: [table.authorID],
      foreignColumns: [memberships.id]
    }).onDelete("set null"),
    foreignKey({
      name: "comment_threads_resolved_by_fk",
      columns: [table.resolvedByID],
      foreignColumns: [memberships.id]
    }).onDelete("set null"),
    index("comment_threads_workspace_entry_idx").on(table.workspaceID, table.entryID)
  ]
);
const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id").notNull(),
    threadID: uuid("thread_id").notNull(),
    authorID: uuid("author_id"),
    content: text("content").notNull(),
    mentionIDs: uuid("mention_ids").array().notNull().default([]),
    ...timestamps
  },
  (table) => [
    foreignKey({
      name: "comments_workspace_thread_fk",
      columns: [table.workspaceID, table.threadID],
      foreignColumns: [commentThreads.workspaceID, commentThreads.id]
    }).onDelete("cascade"),
    foreignKey({
      name: "comments_author_fk",
      columns: [table.authorID],
      foreignColumns: [memberships.id]
    }).onDelete("set null"),
    index("comments_workspace_thread_idx").on(table.workspaceID, table.threadID)
  ]
);

/** Open, or auto-resolved, which a read reopens once it applies again. */
const isThreadOpen = or(isNull(commentThreads.resolvedAt), eq(commentThreads.autoResolved, true))!;
/** As read; reads drop the column's microseconds. */
const isThreadUpdatedAt = (updatedAt: Date) => {
  return sql`date_trunc('milliseconds', ${commentThreads.updatedAt}) = ${updatedAt}`;
};

export { comments, commentThreads, isThreadOpen, isThreadUpdatedAt };
export type { CommentSuggestionData };
