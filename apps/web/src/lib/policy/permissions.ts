import { hasPermission as isGranted } from "@andesine/contracts/permissions";
import type { Permission } from "#web/lib/api";

const hasPermission = (permissions: Permission[], required: Permission) => {
  return permissions.some((granted) => isGranted(granted, required));
};

export { hasPermission };
