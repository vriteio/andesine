import { inviteStatusType } from "@andesine/contracts/entities";
import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { memberships } from "./memberships";
import { roles } from "./roles";
import { workspaces } from "./workspaces";

const invitationStatusEnum = pgEnum("invitation_status", inviteStatusType.enum);

const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    roleID: uuid("role_id").notNull(),
    invitedBy: uuid("invited_by").references(() => memberships.id, {
      onDelete: "set null"
    }),
    status: invitationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => [
    unique("invitations_workspace_id_id_unique").on(table.workspaceID, table.id),
    foreignKey({
      name: "invitations_workspace_role_fk",
      columns: [table.workspaceID, table.roleID],
      foreignColumns: [roles.workspaceID, roles.id]
    }).onDelete("restrict"),
    uniqueIndex("invitations_pending_email_unique")
      .on(table.workspaceID, sql`lower(${table.email})`)
      .where(sql`${table.status} = 'pending'`),
    index("invitations_workspace_status_idx").on(table.workspaceID, table.status),
    index("invitations_invited_by_idx").on(table.invitedBy),
    index("invitations_expires_at_idx").on(table.expiresAt)
  ]
);

export { invitationStatusEnum, invitations };
