import { apiKeys } from "@andesine/server/database";
import { assertKeyDelegation } from "#backend/lib/policy/delegation";
import { toCollectionID, toUUID } from "@andesine/contracts/primitives";
import { db } from "#backend/lib/adapters";
import { type KeyPermission } from "@andesine/contracts/entities";
import { withAuthorization } from "#backend/lib/policy";
import { resolveKeyScope } from "#backend/lib/data";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

interface UpdateKeyInput {
  id: string;
  name?: string;
  permissions?: KeyPermission[];
  collectionIDs?: string[];
  allowedOrigins?: string[];
}

const updateKeyOperation = async (
  input: UpdateKeyInput & { workspaceID: string }
): Promise<void> => {
  const where = and(
    eq(apiKeys.id, toUUID(input.id)),
    eq(apiKeys.workspaceID, toUUID(input.workspaceID))
  );
  const [key] = await db.select().from(apiKeys).where(where);

  if (!key) throw new ORPCError("NOT_FOUND", { message: "Key not found" });

  // The kind cannot change, so the changed values are checked with the stored ones.
  const scope = await resolveKeyScope(input.workspaceID, {
    kind: key.kind,
    permissions: input.permissions ?? key.permissions,
    collectionIDs: input.collectionIDs ?? key.collectionIDs.map(toCollectionID),
    allowedOrigins: input.allowedOrigins ?? key.allowedOrigins
  });

  await db
    .update(apiKeys)
    .set({ ...(input.name !== undefined && { name: input.name }), ...scope, updatedAt: new Date() })
    .where(where);
};
const updateKey = withAuthorization<UpdateKeyInput>(
  { permissions: { session: ["api_keys"] } },
  async ({ auth, input, workspaceID }) => {
    if (input.permissions !== undefined) assertKeyDelegation(auth, input.permissions);
    return updateKeyOperation({ ...input, workspaceID });
  }
);

export { updateKey };
