import { apiKeys } from "@andesine/server/database";
import { assertKeyManager } from "#backend/lib/extensions/publishable-keys";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { and, eq } from "drizzle-orm";

interface DeletePublishableKeyInput {
  keyID: string;
}

const deletePublishableKey = withAuthorization<
  DeletePublishableKeyInput,
  undefined,
  { deleted: boolean }
>({ permissions: { extension: true } }, async ({ auth, database, input }) => {
  const extensionID = assertKeyManager(auth);
  const deleted = await database
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, toUUID(input.keyID)), eq(apiKeys.extensionID, extensionID)))
    .returning({ id: apiKeys.id });

  return { deleted: deleted.length > 0 };
});

export { deletePublishableKey };
