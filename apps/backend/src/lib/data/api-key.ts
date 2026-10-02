import { apiKeys, collections } from "@andesine/server/database";
import {
  publishableKeyPermissionType,
  type Key,
  type KeyKind,
  type KeyPermission
} from "@andesine/contracts/entities";
import { toCollectionID, toKeyID, toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { config } from "#backend/lib/config";
import { decrypt, encrypt, hashKey } from "#backend/lib/security";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { timingSafeEqual } from "node:crypto";

interface KeyScopeInput {
  kind: KeyKind;
  permissions: KeyPermission[];
  collectionIDs?: string[];
  allowedOrigins?: string[];
}

interface KeyScope {
  permissions: KeyPermission[];
  /** UUIDs, for the database. */
  collectionIDs: string[];
  allowedOrigins: string[];
}

const publishablePermissions: readonly KeyPermission[] = publishableKeyPermissionType.options;

const verifyAPIKey = async (rawKey: string): Promise<typeof apiKeys.$inferSelect | null> => {
  const prefix = rawKey.slice(0, 12);
  const candidates = await db.select().from(apiKeys).where(eq(apiKeys.prefix, prefix));

  for (const candidate of candidates) {
    if (candidate.expiresAt && candidate.expiresAt <= new Date()) continue;
    const actual = Buffer.from(hashKey(rawKey, candidate.salt), "hex");
    const expected = Buffer.from(candidate.hash, "hex");

    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return candidate;
  }

  return null;
};
const mapAPIKey = (key: typeof apiKeys.$inferSelect): Key => ({
  id: toKeyID(key.id),
  name: key.name,
  kind: key.kind,
  permissions: key.permissions,
  collectionIDs: key.collectionIDs.map(toCollectionID),
  allowedOrigins: key.allowedOrigins,
  value: key.encryptedValue && decrypt(key.encryptedValue, config.SECRET),
  prefix: key.prefix,
  createdAt: key.createdAt.toISOString(),
  updatedAt: key.updatedAt.toISOString(),
  expiresAt: key.expiresAt?.toISOString() || null
});
/** Publishable keys are public, so their raw value is kept (encrypted) to show it again. */
const encryptKeyValue = (kind: KeyKind, raw: string): string | null => {
  return kind === "publishable" ? encrypt(raw, config.SECRET) : null;
};
const badRequest = (message: string): ORPCError<"BAD_REQUEST", unknown> => {
  return new ORPCError("BAD_REQUEST", { message });
};
/**
 * Checks the rules of a key kind and returns the scope to store. Secret keys have no scope.
 * Publishable keys read published content only, from their collections (all when none are set)
 * and allowed origins.
 */
const resolveKeyScope = async (workspaceID: string, input: KeyScopeInput): Promise<KeyScope> => {
  const collectionIDs = [...new Set(input.collectionIDs ?? [])].map(toUUID);
  const allowedOrigins = [...new Set(input.allowedOrigins ?? [])];

  if (input.kind === "secret") {
    const hasScope = collectionIDs.length > 0 || allowedOrigins.length > 0;

    if (hasScope) throw badRequest("Only publishable keys have collections and origins.");

    return { permissions: input.permissions, collectionIDs, allowedOrigins };
  }

  const hasValidPermissions =
    input.permissions.includes("read:publishing") &&
    input.permissions.every((permission) => publishablePermissions.includes(permission));

  if (!hasValidPermissions) {
    throw badRequest("Publishable keys have read:publishing, and optionally ai-answers.");
  }

  if (!allowedOrigins.length) throw badRequest("Publishable keys need an allowed origin.");

  const found = await db
    .select({ id: collections.id })
    .from(collections)
    .where(
      and(
        eq(collections.workspaceID, toUUID(workspaceID)),
        inArray(collections.id, collectionIDs),
        isNull(collections.deletedAt)
      )
    );

  if (found.length !== collectionIDs.length) {
    throw new ORPCError("NOT_FOUND", { message: "A collection of the key does not exist." });
  }

  return {
    permissions: [...new Set(input.permissions)],
    collectionIDs,
    allowedOrigins
  };
};

export { encryptKeyValue, mapAPIKey, verifyAPIKey, resolveKeyScope };
export type { KeyScope, KeyScopeInput };
