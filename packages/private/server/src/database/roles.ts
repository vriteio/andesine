import { baseRoleType, permissionType } from "@andesine/contracts/entities";
import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./shared";
import { workspaces } from "./workspaces";

const permissionEnum = pgEnum("permission", permissionType.enum);
const baseRoleEnum = pgEnum("base_role", baseRoleType.enum);

const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceID: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    permissions: permissionEnum("permissions")
      .array()
      .notNull()
      .default(sql`'{}'`),
    baseRole: baseRoleEnum("base_role"),
    ...timestamps
  },
  (table) => [
    unique("roles_workspace_id_id_unique").on(table.workspaceID, table.id),
    unique("roles_workspace_base_role_unique").on(table.workspaceID, table.baseRole),
    uniqueIndex("roles_workspace_name_unique").on(table.workspaceID, sql`lower(${table.name})`),
    index("roles_workspace_id_idx").on(table.workspaceID)
  ]
);

export { baseRoleEnum, permissionEnum, roles };
