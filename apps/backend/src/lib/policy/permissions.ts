import {
  type AuthorizationRequirements,
  hasPermission,
  keyPermissionRequirements
} from "@andesine/contracts/permissions";
import { type KeyPermission, type Permission } from "@andesine/contracts/entities";
import { ORPCError } from "@orpc/server";
import { getUserAuthorization, type SessionData } from "./session";
import { MCP_READ_SCOPE, MCP_WRITE_SCOPE } from "#backend/lib/auth/oauth";

// Key permissions that MCP tokens can use; consent covers content only.
const MCP_KEY_PERMISSIONS = new Set<KeyPermission>([
  "entries",
  "collections",
  "versions",
  "publishing",
  "read:entries",
  "read:collections",
  "read:versions",
  "read:publishing"
]);

const isAdminAuthorization = (auth: SessionData): boolean => {
  return getUserAuthorization(auth)?.admin === true;
};
const getGrantedPermissions = (
  auth: SessionData
): Array<KeyPermission | Permission> | undefined => {
  return (
    getUserAuthorization(auth)?.permissions ?? auth.key?.permissions ?? auth.extension?.permissions
  );
};
const getMissingAuthorizationPermissions = (
  auth: SessionData,
  required?: AuthorizationRequirements
): Array<KeyPermission | Permission> | null => {
  if (!required || required === true) return [];

  if (required.extension) {
    if (auth.type === "extension") return [];
    // With `session`, the operation is also for members (for example extension storage).
    if (!required.session) return null;
  }

  if (auth.type !== "oauth" && isAdminAuthorization(auth)) return [];

  const mcpScopes = auth.type === "oauth" ? auth.oauth?.scopes : undefined;
  const writeKeyPermissions = Array.isArray(required.key)
    ? required.key.filter((permission) => !permission.startsWith("read:"))
    : [];
  const isMCPToken = mcpScopes?.some(
    (scope) => scope === MCP_READ_SCOPE || scope === MCP_WRITE_SCOPE
  );
  const outsideMCPScope =
    isMCPToken &&
    Array.isArray(required.key) &&
    required.key.some((permission) => !MCP_KEY_PERMISSIONS.has(permission));
  // MCP clients call only public API operations, and write ones need write scope; the CLI has neither.
  const missingWriteScope =
    isMCPToken && !mcpScopes?.includes(MCP_WRITE_SCOPE) && writeKeyPermissions.length > 0;

  if (isMCPToken && !required.key) return null;
  if (outsideMCPScope) return null;
  if (missingWriteScope) return writeKeyPermissions;

  const oauthPermissions = required.oauth ?? (required.key ? required.session : undefined);
  const mappedKeyPermissions = Array.isArray(required.key)
    ? required.key.flatMap((permission) => keyPermissionRequirements[permission])
    : required.key;
  const requirementType = auth.type === "extension" ? "key" : auth.type;
  const requiredPermissions =
    auth.type === "oauth" ? (oauthPermissions ?? mappedKeyPermissions) : required[requirementType];

  if (!requiredPermissions) return null;
  if (requiredPermissions === true || isAdminAuthorization(auth)) return [];

  const grantedPermissions = getGrantedPermissions(auth);

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
          auth.type !== "session"
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
  if (required === "read:restricted_collections" && auth.hideRestricted) return false;
  if (isAdminAuthorization(auth)) return true;

  const permissions = getGrantedPermissions(auth);

  return permissions?.some((permission) => hasPermission(permission, required)) ?? false;
};
export {
  assertAuthorizationRequirements,
  hasAuthorizationRequirements,
  hasAuthPermission,
  isAdminAuthorization
};
