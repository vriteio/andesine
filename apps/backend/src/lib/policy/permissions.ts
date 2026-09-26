import {
  type AuthorizationRequirements,
  hasPermission,
  keyPermissionRequirements
} from "@andesine/contracts/permissions";
import { type KeyPermission, type Permission } from "@andesine/contracts/entities";
import { ORPCError } from "@orpc/server";
import { getUserAuthorization, type SessionData } from "./session";

const isAdminAuthorization = (auth: SessionData): boolean => {
  return getUserAuthorization(auth)?.admin === true;
};
const getMissingAuthorizationPermissions = (
  auth: SessionData,
  required?: AuthorizationRequirements
): Array<KeyPermission | Permission> | null => {
  if (!required || required === true) return [];
  if (auth.type !== "oauth" && isAdminAuthorization(auth)) return [];

  const oauthPermissions = required.oauth ?? (required.key ? required.session : undefined);
  const mappedKeyPermissions = Array.isArray(required.key)
    ? required.key.flatMap((permission) => keyPermissionRequirements[permission])
    : required.key;
  const requiredPermissions =
    auth.type === "oauth" ? (oauthPermissions ?? mappedKeyPermissions) : required[auth.type];

  if (!requiredPermissions) return null;
  if (requiredPermissions === true || isAdminAuthorization(auth)) return [];

  const grantedPermissions = getUserAuthorization(auth)?.permissions ?? auth.key?.permissions;

  return requiredPermissions.filter((requiredPermission) => {
    return !grantedPermissions?.some((grantedPermission) => {
      return hasPermission(grantedPermission, requiredPermission);
    });
  });
};
const hasAuthorizationRequirements = (
  auth: SessionData,
  required?: AuthorizationRequirements
): boolean => {
  const missingPermissions = getMissingAuthorizationPermissions(auth, required);

  return missingPermissions !== null && missingPermissions.length === 0;
};
const assertAuthorizationRequirements = (
  auth: SessionData,
  required?: AuthorizationRequirements
): void => {
  const missingPermissions = getMissingAuthorizationPermissions(auth, required);

  if (missingPermissions?.length === 0) return;
  if (!missingPermissions) {
    throw new ORPCError("FORBIDDEN", {
      data: {
        hints: [
          auth.type === "key" || auth.type === "oauth"
            ? "This action requires a signed-in user session."
            : "This action is not available with session credentials."
        ]
      }
    });
  }

  throw new ORPCError("FORBIDDEN", {
    message: `Missing required permissions: ${missingPermissions.join(", ")}`,
    data: { missingPermissions, hints: ["Use credentials with the required permissions."] }
  });
};
const hasAuthPermission = (auth: SessionData, required: KeyPermission | Permission): boolean => {
  if (isAdminAuthorization(auth)) return true;

  const permissions = getUserAuthorization(auth)?.permissions ?? auth.key?.permissions;

  return permissions?.some((permission) => hasPermission(permission, required)) ?? false;
};
export {
  assertAuthorizationRequirements,
  hasAuthorizationRequirements,
  hasAuthPermission,
  isAdminAuthorization
};
