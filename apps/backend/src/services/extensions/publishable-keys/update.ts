import { type Key } from "@andesine/contracts/entities";
import { apiKeys } from "@andesine/server/database";
import { mapAPIKey, resolveKeyScope } from "#backend/lib/data";
import {
  assertKeyManager,
  assertReadableCollections,
  getManagedKeyPermissions,
  loadManagedKey
} from "#backend/lib/extensions/publishable-keys";
import { withAuthorization } from "#backend/lib/policy";
import { toCollectionID } from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";

interface UpdatePublishableKeyInput {
  keyID: string;
  name?: string;
  collectionIDs?: string[];
  allowedOrigins?: string[];
  answers?: boolean;
}

const updatePublishableKey = withAuthorization<UpdatePublishableKeyInput, undefined, Key>(
  { permissions: { extension: true }, transaction: "atomic" },
  async ({ auth, database, input, workspaceID }) => {
    const extensionID = assertKeyManager(auth);
    const key = await loadManagedKey(database, extensionID, input.keyID);
    const collectionIDs = input.collectionIDs ?? key.collectionIDs.map(toCollectionID);
    const permissions =
      input.answers === undefined ? key.permissions : getManagedKeyPermissions(auth, input.answers);
    const scope = await resolveKeyScope(workspaceID, {
      kind: "publishable",
      permissions,
      collectionIDs,
      allowedOrigins: input.allowedOrigins ?? key.allowedOrigins
    });

    if (input.collectionIDs) await assertReadableCollections(auth, database, collectionIDs);
    const [updated] = await database
      .update(apiKeys)
      .set({ ...scope, name: input.name ?? key.name, updatedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .returning();

    return mapAPIKey(updated);
  }
);

export { updatePublishableKey };
