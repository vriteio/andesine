import { keyPermissionRequirements } from "@andesine/contracts/permissions";
import {
  RESTRICTED_CONTENT_PERMISSION,
  type ExtensionPermission
} from "@andesine/contracts/extensions";
import { type KeyPermission, type Permission } from "@andesine/contracts/entities";
import { hasAuthPermission, isAdminAuthorization } from "./permissions";
import type { SessionData } from "./session";

const rolePermissionRequirements: Partial<Record<Permission, KeyPermission[]>> = {
  "content": ["entries", "collections", "versions", "publishing"],
  "publishing": ["publishing"],
  "memberships": ["memberships"],
  "roles": ["roles"],
  "webhooks": ["webhooks"],
  "read:webhooks": ["read:webhooks"]
};
// API keys and extensions hold API-key permissions, not role permissions.
const isAPIAuthorization = (auth: SessionData): boolean => {
  return auth.type === "key" || auth.type === "extension";
};
const canGrantKeyPermission = (auth: SessionData, permission: KeyPermission): boolean => {
  return (
    auth.type === "session" &&
    keyPermissionRequirements[permission].every((required) => hasAuthPermission(auth, required))
  );
};
// Grants follow API-key delegation; restricted content needs workspace-wide read access.
const canGrantExtensionPermission = (
  auth: SessionData,
  permission: ExtensionPermission
): boolean => {
  if (permission !== RESTRICTED_CONTENT_PERMISSION) return canGrantKeyPermission(auth, permission);

  return auth.type === "session" && hasAuthPermission(auth, RESTRICTED_CONTENT_PERMISSION);
};
// Development extensions run only locally, so the CLI's OAuth member grants like a session.
const canGrantDevelopmentPermission = (
  auth: SessionData,
  permission: ExtensionPermission
): boolean => {
  const member =
    auth.type === "oauth" ? { ...auth, type: "session" as const, session: auth.oauth } : auth;

  return canGrantExtensionPermission(member, permission);
};
const canGrantRolePermission = (auth: SessionData, permission: Permission): boolean => {
  if (!isAPIAuthorization(auth)) return hasAuthPermission(auth, permission);

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
    isAPIAuthorization(auth) &&
    !defaultReadPermissions.every((permission) => hasAuthPermission(auth, permission))
  ) {
    return false;
  }

  return role.permissions.every((permission) => canGrantRolePermission(auth, permission));
};

export {
  canGrantKeyPermission,
  canGrantExtensionPermission,
  canGrantDevelopmentPermission,
  canGrantRolePermission,
  canGrantRole
};
