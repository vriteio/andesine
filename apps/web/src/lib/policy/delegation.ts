import { useWorkspace } from "#web/context/workspace";
import { keyPermissionRequirements } from "#backend/lib/policy/permission-requirements";
import type { KeyPermission, Permission } from "#web/lib/api";

const useDelegationPermissions = () => {
  const { currentWorkspace, hasPermission } = useWorkspace();
  const canGrantKeyPermission = (permission: KeyPermission) => {
    return (
      Boolean(currentWorkspace()) && keyPermissionRequirements[permission].every(hasPermission)
    );
  };
  const canGrantRole = (role: { baseRole?: string | null; permissions: Permission[] }) => {
    if (role.baseRole === "admin") return currentWorkspace()?.admin === true;

    return Boolean(currentWorkspace()) && role.permissions.every(hasPermission);
  };

  return { canGrantKeyPermission, canGrantRole, canGrantRolePermission: hasPermission };
};

export { useDelegationPermissions };
