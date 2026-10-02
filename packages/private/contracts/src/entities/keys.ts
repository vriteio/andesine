import { id, publicID } from "../primitives/id";
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
/** A secret key stays on servers; a publishable key is safe in browsers, for published content. */
const keyKindType = z.enum(["secret", "publishable"]);
/** Permissions that a publishable key can have. It always needs `read:publishing`. */
const publishableKeyPermissionType = z.enum(["read:publishing", "ai-answers"]);
/** An origin without a path, e.g. `https://docs.example.com`. */
const keyOriginType = z
  .string()
  .regex(/^https?:\/\/[a-z\d.-]+(?::\d{1,5})?$/i, "Use an origin, e.g. https://docs.example.com")
  .transform((origin) => origin.toLowerCase());
const keyType = z.object({
  id: id().describe("The ID of the API key"),
  name: z.string().describe("The name for the API key"),
  kind: keyKindType.describe("Secret keys stay on servers; publishable keys work in browsers"),
  permissions: z.array(keyPermissionType).describe("The permissions of the API key"),
  collectionIDs: z
    .array(publicID("coll"))
    .describe(
      "Publishable keys: the collections, with their descendants, that the key can read; none for all"
    ),
  allowedOrigins: z
    .array(z.string())
    .describe("Publishable keys: the browser origins that can use the key, with localhost"),
  value: z
    .string()
    .nullable()
    .describe("Publishable keys: the raw key, which is public; null for secret keys"),
  prefix: z.string().describe("The first characters of the raw key"),
  createdAt: z.iso.datetime().describe("The creation date"),
  updatedAt: z.iso.datetime().describe("The last update date"),
  expiresAt: z.iso.datetime().nullable().describe("The expiration date")
});
type KeyPermission = z.infer<typeof keyPermissionType>;
type KeyKind = z.infer<typeof keyKindType>;
type Key = z.infer<typeof keyType>;
export { keyPermissionType, keyKindType, publishableKeyPermissionType, keyOriginType, keyType };
export type { Key, KeyKind, KeyPermission };
