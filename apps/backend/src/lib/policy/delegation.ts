import type { KeyPermission, Permission } from "#backend/db";
import { ORPCError } from "@orpc/server";
import { canGrantKeyPermission, canGrantRole } from "./delegation-permissions";
import { isAdminAuthorization } from "./permissions";
import type { SessionData } from "./session";

const assertAdminManagement = (auth: SessionData, baseRole?: string | null): void => {
  if (baseRole === "admin" && !isAdminAuthorization(auth)) {
    throw new ORPCError("FORBIDDEN", { message: "Only admins can manage administrators" });
  }
};
const assertRoleDelegation = (
  auth: SessionData,
  role: { baseRole?: string | null; permissions: Permission[] }
): void => {
  assertAdminManagement(auth, role.baseRole);
  if (!canGrantRole(auth, role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "You cannot grant or manage a role beyond your own permissions"
    });
  }
};
const assertKeyDelegation = (auth: SessionData, permissions: KeyPermission[]): void => {
  if (!permissions.every((permission) => canGrantKeyPermission(auth, permission))) {
    throw new ORPCError("FORBIDDEN", {
      message: "You cannot grant API key permissions beyond your own role"
    });
  }
};

export { assertAdminManagement, assertRoleDelegation, assertKeyDelegation };
