import type { KeyPermission, Permission } from "#backend/db";
import { ORPCError } from "@orpc/server";
import { canGrantKeyPermission, canGrantRole } from "./delegation-permissions";
import { isAdminAuthorization } from "./permissions";
import type { SessionData } from "./session";

const assertAdminManagement = (auth: SessionData, baseRole?: string | null): void => {
  if (baseRole === "admin" && !isAdminAuthorization(auth)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only admins can manage administrators",
      data: {
        hints: ["Use an administrator session. API keys cannot manage administrator memberships."]
      }
    });
  }
};
const assertRoleDelegation = (
  auth: SessionData,
  role: { baseRole?: string | null; permissions: Permission[] }
): void => {
  assertAdminManagement(auth, role.baseRole);
  if (!canGrantRole(auth, role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "You cannot grant or manage a role beyond your own permissions",
      data: {
        hints: [
          "Choose a role within your permissions or ask a workspace administrator to assign it. API keys also need read access to entries, collections, publishing, memberships, and roles to delegate a role."
        ]
      }
    });
  }
};
const assertKeyDelegation = (auth: SessionData, permissions: KeyPermission[]): void => {
  if (!permissions.every((permission) => canGrantKeyPermission(auth, permission))) {
    throw new ORPCError("FORBIDDEN", {
      message: "You cannot grant API key permissions beyond your own role",
      data: {
        hints: [
          "Reduce the requested key permissions or ask a workspace administrator to create the key."
        ]
      }
    });
  }
};

export { assertAdminManagement, assertRoleDelegation, assertKeyDelegation };
