import { apiKeys } from "@andesine/server/database";
import { assertKeyDelegation } from "#backend/lib/policy/delegation";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { type Key } from "@andesine/contracts/entities";
import { withAuthorization } from "#backend/lib/policy";
import { generateKeyValue, generateSalt, hashKey } from "#backend/lib/security";
import { encryptKeyValue, mapAPIKey, resolveKeyScope, type KeyScopeInput } from "#backend/lib/data";

interface CreateKeyInput extends KeyScopeInput {
  name: string;
}

const createKeyOperation = async (
  input: CreateKeyInput & { workspaceID: string }
): Promise<Key & { rawKey: string }> => {
  const scope = await resolveKeyScope(input.workspaceID, input);
  const { raw, prefix } = generateKeyValue(input.kind);
  const salt = generateSalt();
  const now = new Date();
  const [key] = await db
    .insert(apiKeys)
    .values({
      name: input.name,
      kind: input.kind,
      ...scope,
      encryptedValue: encryptKeyValue(input.kind, raw),
      prefix,
      workspaceID: toUUID(input.workspaceID),
      hash: hashKey(raw, salt),
      salt,
      createdAt: now,
      updatedAt: now
    })
    .returning();

  return { ...mapAPIKey(key), rawKey: raw };
};
const createKey = withAuthorization<CreateKeyInput, undefined, Key & { rawKey: string }>(
  { permissions: { session: ["api_keys"] } },
  async ({ auth, input, workspaceID }) => {
    assertKeyDelegation(auth, input.permissions);
    return createKeyOperation({ ...input, workspaceID });
  }
);

export { createKey };
