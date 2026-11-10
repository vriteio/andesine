import { memberships, roles, workspaces } from "@andesine/server/database";
import { toMembershipID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

interface UserMembership {
  workspaceID: string;
  workspaceName: string;
  memberID: string;
  soleAdmin: boolean;
}

const otherMemberships = alias(memberships, "other_memberships");
const otherRoles = alias(roles, "other_roles");

const listUserMemberships = async (input: { userID: string }): Promise<UserMembership[]> => {
  const otherAdmins = db
    .select({ id: otherMemberships.id })
    .from(otherMemberships)
    .innerJoin(otherRoles, eq(otherRoles.id, otherMemberships.roleID))
    .where(
      and(
        eq(otherMemberships.workspaceID, memberships.workspaceID),
        ne(otherMemberships.userID, memberships.userID),
        eq(otherRoles.baseRole, "admin")
      )
    );
  const rows = await db
    .select({
      workspaceID: memberships.workspaceID,
      workspaceName: workspaces.name,
      memberID: memberships.id,
      soleAdmin: sql<boolean>`${roles.baseRole} = 'admin' and not exists ${otherAdmins}`
    })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleID))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceID))
    .where(and(eq(memberships.userID, toUUID(input.userID)), isNull(workspaces.deletingAt)));

  return rows.map((row) => ({
    workspaceID: toWorkspaceID(row.workspaceID),
    workspaceName: row.workspaceName,
    memberID: toMembershipID(row.memberID),
    soleAdmin: row.soleAdmin
  }));
};

export { listUserMemberships };
export type { UserMembership };
