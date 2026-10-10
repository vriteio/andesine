import { type KeyPermission } from "../entities/keys";
import { type Permission } from "../entities/roles";

interface TypedAuthorizationRequirements {
  key?: KeyPermission[] | true;
  session?: Permission[] | true;
  oauth?: Permission[] | true;
  /** Operations of the extension API: only the extension principal (extension JWT). */
  extension?: true;
}
interface ParsedPermission {
  access: string;
  resource: string;
}
type AuthorizationRequirements = TypedAuthorizationRequirements | true;
const parsePermission = (permission: string): ParsedPermission => {
  const [accessOrResource, readResource] = permission.split(":");

  return readResource
    ? { resource: readResource, access: accessOrResource }
    : { resource: accessOrResource, access: "write" };
};
const hasPermission = (granted: string, required: string): boolean => {
  const grantedPermission = parsePermission(granted);
  const requiredPermission = parsePermission(required);

  if (grantedPermission.resource !== requiredPermission.resource) return false;

  return grantedPermission.access === "write" || requiredPermission.access === "read";
};
export { hasPermission };
export type { AuthorizationRequirements };
