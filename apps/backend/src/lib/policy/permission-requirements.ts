import type { KeyPermission, Permission } from "#backend/db";

const keyPermissionRequirements: Record<KeyPermission, Permission[]> = {
  "entries": ["content"],
  "read:entries": [],
  "collections": ["content"],
  "read:collections": [],
  "versions": ["content"],
  "read:versions": ["content"],
  "publishing": ["content", "publishing"],
  "read:publishing": [],
  "memberships": ["memberships"],
  "read:memberships": [],
  "roles": ["roles"],
  "read:roles": []
};

export { keyPermissionRequirements };
