import { shareAccessType, shareKindType } from "@andesine/contracts/entities";
import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { entries } from "./entries";
import { memberships } from "./memberships";
import { timestamps } from "./shared";
import { users } from "./users";
import { workspaces } from "./workspaces";

const shareKindEnum = pgEnum("share_kind", shareKindType.enum);
const shareAccessEnum = pgEnum("share_access", shareAccessType.enum);

const entryShares = pgTable(
  "entry_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryID: uuid("entry_id").notNull(),
    kind: shareKindEnum("kind").notNull(),
    access: shareAccessEnum("access").notNull(),
    /** Link shares only; members can copy the link at any time. */
    token: text("token").unique(),
    email: varchar("email", { length: 320 }),
    createdByID: uuid("created_by_id").references(() => memberships.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    unique("entry_shares_workspace_id_id_unique").on(table.workspaceID, table.id),
    index("entry_shares_created_by_id_idx").on(table.createdByID),
    foreignKey({
      name: "entry_shares_workspace_entry_fk",
      columns: [table.workspaceID, table.entryID],
      foreignColumns: [entries.workspaceID, entries.id]
    }).onDelete("cascade"),
    uniqueIndex("entry_shares_link_unique")
      .on(table.entryID)
      .where(sql`${table.kind} = 'link'`),
    // Emails are stored in lower case.
    uniqueIndex("entry_shares_email_unique")
      .on(table.entryID, table.email)
      .where(sql`${table.kind} = 'email'`)
  ]
);
/** Rows stay after their share is removed, so comments keep the visitor's name. */
const visitors = pgTable(
  "visitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    shareID: uuid("share_id").references(() => entryShares.id, { onDelete: "set null" }),
    userID: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 50 }),
    /** For the cleanup of unused visitors; updated once a day at most. */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("visitors_workspace_id_id_unique").on(table.workspaceID, table.id),
    index("visitors_share_id_idx").on(table.shareID),
    index("visitors_user_id_idx").on(table.userID),
    // One visitor per account and share, so their comments keep one author.
    uniqueIndex("visitors_share_user_unique")
      .on(table.shareID, table.userID)
      .where(sql`${table.userID} is not null`)
  ]
);
/** One per join, so a visitor can be open on several devices. */
const visitorTokens = pgTable(
  "visitor_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitorID: uuid("visitor_id")
      .notNull()
      .references(() => visitors.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("visitor_tokens_visitor_id_idx").on(table.visitorID)]
);

export { entryShares, visitors, visitorTokens, shareAccessEnum, shareKindEnum };
