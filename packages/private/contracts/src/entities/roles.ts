import { id } from "../primitives/id";
import * as z from "zod";

const permissionType = z.enum([
  "content",
  "publishing",
  "api_keys",
  "read:api_keys",
  "billing",
  "read:billing",
  "restricted_collections",
  "read:restricted_collections",
  "memberships",
  "roles",
  "webhooks",
  "read:webhooks",
  "extensions",
  "workspace"
]);
const baseRoleType = z.enum(["admin", "viewer"]);
const roleType = z.object({
  id: id().describe("ID of the role"),
  name: z.string().min(1).max(50).describe("Name of the role"),
  permissions: z.array(permissionType).describe("Permissions granted to the role"),
  baseRole: baseRoleType.optional().describe("If this role is an unremovable base role")
});
type Permission = z.infer<typeof permissionType>;
type BaseRole = z.infer<typeof baseRoleType>;
type Role = z.infer<typeof roleType>;
export { baseRoleType, permissionType, roleType };
export type { BaseRole, Permission, Role };
