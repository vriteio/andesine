import { type ExtensionStorageEntry } from "@andesine/contracts/extensions";
import { extensionStorage } from "@andesine/server/database";
import { getStorageOwner } from "#backend/lib/extensions/storage";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

interface GetStorageEntryInput {
  extensionID?: string;
  key: string;
}

const getEntry = withAuthorization<GetStorageEntryInput, undefined, ExtensionStorageEntry>(
  { permissions: { session: true, extension: true } },
  async ({ auth, database, input, workspaceID }) => {
    const owner = await getStorageOwner({ database, auth, workspaceID, ...input });
    const [entry] = await database
      .select()
      .from(extensionStorage)
      .where(and(eq(extensionStorage.extensionID, owner), eq(extensionStorage.key, input.key)));

    if (!entry) throw new ORPCError("NOT_FOUND", { message: "Storage entry not found" });

    return {
      key: entry.key,
      value: entry.value as ExtensionStorageEntry["value"],
      updatedAt: entry.updatedAt.toISOString()
    };
  }
);

export { getEntry };
