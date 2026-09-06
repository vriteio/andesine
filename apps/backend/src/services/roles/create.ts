import { assertRoleDelegation } from "#backend/lib/policy/delegation";
import type { SessionData } from "#backend/lib/policy/session";
import { toRoleID, toUUID } from "#backend/lib/primitives";
import { db } from "#backend/lib/adapters";
import { type Permission, roles, type Role } from "#backend/db";
import { withAuthorization } from "#backend/lib/policy";
import {
  duplicateRoleNameError,
  isRoleNameUniqueViolation,
  validateRoleName
} from "#backend/lib/data";

interface CreateRoleInput {
  name: string;
  permissions: Permission[];
}

const createRoleOperation = async (
  input: CreateRoleInput & {
    workspaceID: string;
    auth: SessionData;
  }
): Promise<Role> => {
  assertRoleDelegation(input.auth, { permissions: input.permissions });
  const name = await validateRoleName(input);

  try {
    const [role] = await db
      .insert(roles)
      .values({
        workspaceID: toUUID(input.workspaceID),
        name,
        permissions: input.permissions
      })
      .returning();

    return { id: toRoleID(role.id), name: role.name, permissions: role.permissions };
  } catch (error) {
    if (isRoleNameUniqueViolation(error)) throw duplicateRoleNameError();

    throw error;
  }
};
const createRole = withAuthorization<CreateRoleInput, undefined, Role>(
  { permissions: { session: ["roles"], key: ["roles"] }, plan: "pro" },
  async ({ auth, input, workspaceID }) => createRoleOperation({ ...input, auth, workspaceID })
);

export { createRole };
