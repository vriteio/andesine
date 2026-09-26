import { roles } from "@andesine/server/database";
import { toRoleID, toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { type Role } from "@andesine/contracts/entities";
import { withAuthorization } from "#backend/lib/policy";
import { eq } from "drizzle-orm";

const listRolesOperation = async (input: { workspaceID: string }): Promise<{ roles: Role[] }> => {
  const rows = await db
    .select()
    .from(roles)
    .where(eq(roles.workspaceID, toUUID(input.workspaceID)));

  return {
    roles: rows.map((role) => ({
      id: toRoleID(role.id),
      name: role.name,
      permissions: role.permissions,
      ...(role.baseRole && { baseRole: role.baseRole })
    }))
  };
};
const listRoles = withAuthorization<Record<never, never>, undefined, { roles: Role[] }>(
  { permissions: { session: true, key: ["read:roles"] } },
  async ({ workspaceID }) => listRolesOperation({ workspaceID })
);

export { listRoles };
