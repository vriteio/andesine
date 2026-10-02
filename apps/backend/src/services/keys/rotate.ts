import { apiKeys, workspaces } from "@andesine/server/database";
import { assertKeyDelegation } from "#backend/lib/policy/delegation";
import type { SessionData } from "#backend/lib/policy/session";
import { toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { type Key } from "@andesine/contracts/entities";
import { withAuthorization } from "#backend/lib/policy";
import { generateKeyValue, generateSalt, hashKey } from "#backend/lib/security";
import { encryptKeyValue, mapAPIKey } from "#backend/lib/data";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

type ExpirationOption = "now" | "1h" | "24h" | "7d";
interface RotateKeyInput {
  expiresIn: ExpirationOption;
  id: string;
}

const getExpiresAt = (option: ExpirationOption): Date => {
  const durations = { "now": 0, "1h": 3600e3, "24h": 86400e3, "7d": 7 * 86400e3 };

  return new Date(Date.now() + durations[option]);
};
const rotateKeyOperation = async (
  input: RotateKeyInput & { workspaceID: string; auth: SessionData }
): Promise<Key & { rawKey: string }> => {
  const workspaceID = toUUID(input.workspaceID);
  const salt = generateSalt();
  const now = new Date();

  let raw = "";

  const newKey = await db.transaction(async (tx) => {
    const [workspace] = await tx
      .select({ deletingAt: workspaces.deletingAt })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceID))
      .for("update");

    if (!workspace || workspace.deletingAt) {
      throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
    }

    const [oldKey] = await tx
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, toUUID(input.id)), eq(apiKeys.workspaceID, workspaceID)))
      .for("update");

    if (!oldKey) throw new ORPCError("NOT_FOUND", { message: "Key not found" });

    assertKeyDelegation(input.auth, oldKey.permissions);

    const value = generateKeyValue(oldKey.kind);

    raw = value.raw;

    await tx
      .update(apiKeys)
      .set({ expiresAt: getExpiresAt(input.expiresIn), updatedAt: now })
      .where(eq(apiKeys.id, oldKey.id));
    const [created] = await tx
      .insert(apiKeys)
      .values({
        name: oldKey.name,
        kind: oldKey.kind,
        permissions: oldKey.permissions,
        collectionIDs: oldKey.collectionIDs,
        allowedOrigins: oldKey.allowedOrigins,
        encryptedValue: encryptKeyValue(oldKey.kind, raw),
        prefix: value.prefix,
        workspaceID,
        hash: hashKey(raw, salt),
        salt,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return created;
  });
  return { ...mapAPIKey(newKey), rawKey: raw };
};
const rotateKey = withAuthorization<RotateKeyInput, undefined, Key & { rawKey: string }>(
  { permissions: { session: ["api_keys"] } },
  async ({ auth, input, workspaceID }) => {
    return rotateKeyOperation({ ...input, auth, workspaceID });
  }
);

export { rotateKey };
export type { ExpirationOption };
