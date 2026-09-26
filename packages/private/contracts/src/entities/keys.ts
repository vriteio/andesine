import { id } from "../primitives/id";
import * as z from "zod";

const keyPermissionType = z.enum([
  "entries",
  "read:entries",
  "versions",
  "read:versions",
  "publishing",
  "read:publishing",
  "collections",
  "read:collections",
  "memberships",
  "read:memberships",
  "roles",
  "read:roles",
  "webhooks",
  "read:webhooks",
  "ai-answers"
]);
const keyType = z.object({
  id: id().describe("The ID of the API key"),
  name: z.string().describe("The name for the API key"),
  permissions: z.array(keyPermissionType).describe("The permissions of the API key"),
  prefix: z.string().describe("The first characters of the raw key"),
  createdAt: z.iso.datetime().describe("The creation date"),
  updatedAt: z.iso.datetime().describe("The last update date"),
  expiresAt: z.iso.datetime().nullable().describe("The expiration date")
});
type KeyPermission = z.infer<typeof keyPermissionType>;
type Key = z.infer<typeof keyType>;
export { keyPermissionType, keyType };
export type { Key, KeyPermission };
