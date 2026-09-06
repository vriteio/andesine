import { keyPermissionRequirements } from "./permission-requirements";
import type { KeyPermission, Permission } from "#backend/db";
import { hasAuthPermission, isAdminAuthorization } from "./permissions";
import type { SessionData } from "./session";

const rolePermissionRequirements: Partial<Record<Permission, KeyPermission[]>> = {
  content: ["entries", "collections", "versions", "publishing"],
  publishing: ["publishing"],
  memberships: ["memberships"],
  roles: ["roles"]
};
const canGrantKeyPermission = (auth: SessionData, permission: KeyPermission): boolean => {
  return (
    auth.type === "session" &&
    keyPermissionRequirements[permission].every((required) => hasAuthPermission(auth, required))
  );
};
const canGrantRolePermission = (auth: SessionData, permission: Permission): boolean => {
  if (auth.type === "session") return hasAuthPermission(auth, permission);

  const required = rolePermissionRequirements[permission];

  return Boolean(required && required.every((permission) => hasAuthPermission(auth, permission)));
};
const canGrantRole = (
  auth: SessionData,
  role: { baseRole?: string | null; permissions: Permission[] }
): boolean => {
  if (role.baseRole === "admin") return isAdminAuthorization(auth);

  // Roles include read access to these resources even when their permission array is empty.
  const defaultReadPermissions: KeyPermission[] = [
    "read:entries",
    "read:collections",
    "read:publishing",
    "read:memberships",
    "read:roles"
  ];

  if (
    auth.type === "key" &&
    !defaultReadPermissions.every((permission) => hasAuthPermission(auth, permission))
  ) {
    return false;
  }

  return role.permissions.every((permission) => canGrantRolePermission(auth, permission));
};

export { canGrantKeyPermission, canGrantRolePermission, canGrantRole };
