import { type Permission } from "../entities/roles";
import { keyPermissionRequirements } from "../permissions/key-requirements";
import { hasPermission } from "../permissions/requirements";
import { RESTRICTED_CONTENT_PERMISSION, type ExtensionPermission } from "./manifest";

interface ExtensionMemberAuthority {
  admin?: boolean;
  permissions: Permission[];
}

const hasMemberPermission = (member: ExtensionMemberAuthority, required: Permission): boolean => {
  return (
    member.admin === true || member.permissions.some((granted) => hasPermission(granted, required))
  );
};
/** The frontend grant, limited to the member; backend JWT requests use the full grant. */
const getEffectiveExtensionPermissions = (
  grant: ExtensionPermission[],
  member: ExtensionMemberAuthority
): ExtensionPermission[] => {
  return grant.filter((permission) => {
    if (permission === RESTRICTED_CONTENT_PERMISSION) {
      return hasMemberPermission(member, RESTRICTED_CONTENT_PERMISSION);
    }

    return keyPermissionRequirements[permission].every((required) => {
      return hasMemberPermission(member, required);
    });
  });
};

export { getEffectiveExtensionPermissions };
export type { ExtensionMemberAuthority };
