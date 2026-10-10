import {
  type ExtensionPermission,
  RESTRICTED_CONTENT_PERMISSION
} from "@andesine/contracts/extensions";
import { type useDelegationPermissions } from "#web/lib/policy/delegation";

type Delegation = ReturnType<typeof useDelegationPermissions>;

/** Mirrors the backend grant rule; restricted content needs workspace-wide read access. */
const canGrantExtensionPermission = (delegation: Delegation) => {
  return (permission: ExtensionPermission): boolean => {
    if (permission === RESTRICTED_CONTENT_PERMISSION) {
      return delegation.canGrantRolePermission(RESTRICTED_CONTENT_PERMISSION);
    }

    return delegation.canGrantKeyPermission(permission);
  };
};

export { canGrantExtensionPermission };
