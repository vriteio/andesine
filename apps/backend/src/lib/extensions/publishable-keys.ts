import {
  RESTRICTED_CONTENT_PERMISSION,
  type ExtensionPublishableKey
} from "@andesine/contracts/extensions";
import { type Key, type KeyPermission } from "@andesine/contracts/entities";
import { toUUID } from "@andesine/contracts/primitives";
import { apiKeys, type DatabaseTransaction } from "@andesine/server/database";
import { loadAuthorizedCollectionTree, type SessionData } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

const MAX_MANAGED_KEYS = 10;

const assertKeyManager = (auth: SessionData): string => {
  if (!auth.extension?.publishableKeys) {
    throw new ORPCError("FORBIDDEN", {
      message: "The extension needs the publishable-keys permission",
      data: { hints: ["Add publishable-keys to the manifest's permissions and approve it."] }
    });
  }

  return toUUID(auth.extension.extensionID);
};
const getManagedKeyPermissions = (auth: SessionData, answers: boolean): KeyPermission[] => {
  if (!answers) return ["read:publishing"];

  if (!auth.extension?.permissions.includes("ai-answers")) {
    throw new ORPCError("FORBIDDEN", {
      message: "AI answers need the extension's ai-answers permission"
    });
  }

  return ["read:publishing", "ai-answers"];
};
/** Keys never read restricted collections, so restricted access doesn't count. */
const assertReadableCollections = async (
  auth: SessionData,
  database: DatabaseTransaction,
  collectionIDs: string[]
): Promise<void> => {
  const extension = auth.extension!;
  const permissions = extension.permissions.filter((permission) => {
    return permission !== RESTRICTED_CONTENT_PERMISSION;
  });
  const tree = await loadAuthorizedCollectionTree({
    auth: { ...auth, extension: { ...extension, permissions } },
    database
  });
  const unreadable = collectionIDs.find((id) => !tree.canEntry(id, "publishing:read"));

  if (unreadable) {
    throw new ORPCError("FORBIDDEN", {
      message: "The extension can't read the published content of a collection of the key"
    });
  }
};
const loadManagedKey = async (
  database: DatabaseTransaction,
  extensionID: string,
  keyID: string
): Promise<typeof apiKeys.$inferSelect> => {
  const [key] = await database
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, toUUID(keyID)), eq(apiKeys.extensionID, extensionID)))
    .for("update");

  if (!key) throw new ORPCError("NOT_FOUND", { message: "Key not found" });

  return key;
};
const toManagedKey = (key: Key): ExtensionPublishableKey => {
  const { id, name, permissions, collectionIDs, allowedOrigins, value, createdAt, updatedAt } = key;

  return {
    id,
    name,
    permissions,
    collectionIDs,
    allowedOrigins,
    value: value!,
    createdAt,
    updatedAt
  };
};

export {
  MAX_MANAGED_KEYS,
  assertKeyManager,
  getManagedKeyPermissions,
  assertReadableCollections,
  loadManagedKey,
  toManagedKey
};
