import { type Key } from "@andesine/contracts/entities";
import { apiKeys } from "@andesine/server/database";
import { encryptKeyValue, mapAPIKey, resolveKeyScope } from "#backend/lib/data";
import {
  MAX_MANAGED_KEYS,
  assertKeyManager,
  assertReadableCollections,
  getManagedKeyPermissions
} from "#backend/lib/extensions/publishable-keys";
import { withAuthorization } from "#backend/lib/policy";
import { generateKeyValue, generateSalt, hashKey } from "#backend/lib/security";
import { ORPCError } from "@orpc/server";
import { eq, sql } from "drizzle-orm";

interface CreatePublishableKeyInput {
  name: string;
  collectionIDs: string[];
  allowedOrigins: string[];
  answers: boolean;
}

/** The workspace lock serializes the key limit. */
const createPublishableKey = withAuthorization<CreatePublishableKeyInput, undefined, Key>(
  { permissions: { extension: true }, transaction: "locked-workspace" },
  async ({ auth, database, input, workspaceID }) => {
    const extensionID = assertKeyManager(auth);
    const [{ count }] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeys)
      .where(eq(apiKeys.extensionID, extensionID));

    if (count >= MAX_MANAGED_KEYS) {
      throw new ORPCError("FORBIDDEN", {
        message: `An extension can manage up to ${MAX_MANAGED_KEYS} publishable keys`
      });
    }

    const scope = await resolveKeyScope(workspaceID, {
      kind: "publishable",
      permissions: getManagedKeyPermissions(auth, input.answers),
      collectionIDs: input.collectionIDs,
      allowedOrigins: input.allowedOrigins
    });

    await assertReadableCollections(auth, database, input.collectionIDs);

    const { raw, prefix } = generateKeyValue("publishable");
    const salt = generateSalt();
    const [key] = await database
      .insert(apiKeys)
      .values({
        workspaceID,
        extensionID,
        name: input.name,
        kind: "publishable",
        ...scope,
        encryptedValue: encryptKeyValue("publishable", raw),
        prefix,
        hash: hashKey(raw, salt),
        salt
      })
      .returning();

    return mapAPIKey(key);
  }
);

export { createPublishableKey };
