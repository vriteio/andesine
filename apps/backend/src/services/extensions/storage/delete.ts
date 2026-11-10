import { extensionStorage } from "@andesine/server/database";
import { getStorageOwner } from "#backend/lib/extensions/storage";
import { withAuthorization } from "#backend/lib/policy";
import { and, eq } from "drizzle-orm";

interface DeleteStorageEntryInput {
  extensionID?: string;
  key: string;
}
interface DeleteStorageEntryResult {
  deleted: boolean;
}

const deleteEntry = withAuthorization<DeleteStorageEntryInput, undefined, DeleteStorageEntryResult>(
  { permissions: { session: true, extension: true } },
  async ({ auth, database, input, workspaceID }) => {
    const owner = await getStorageOwner({ database, auth, workspaceID, ...input });
    const deleted = await database
      .delete(extensionStorage)
      .where(and(eq(extensionStorage.extensionID, owner), eq(extensionStorage.key, input.key)))
      .returning({ key: extensionStorage.key });

    return { deleted: deleted.length > 0 };
  }
);

export { deleteEntry };
