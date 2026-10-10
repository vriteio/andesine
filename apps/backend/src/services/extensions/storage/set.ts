import { extensionStorageLimits, type ExtensionStorageWrite } from "@andesine/contracts/extensions";
import { extensionStorage } from "@andesine/server/database";
import { getStorageOwner, getStorageValueSize } from "#backend/lib/extensions/storage";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, ne, sql } from "drizzle-orm";

interface SetStorageEntryInput {
  extensionID?: string;
  key: string;
  value: unknown;
}

/** The locked extension row serializes writes, so concurrent writes cannot exceed the quota. */
const setEntry = withAuthorization<SetStorageEntryInput, undefined, ExtensionStorageWrite>(
  { permissions: { session: true, extension: true }, transaction: "atomic" },
  async ({ auth, database, input, workspaceID }) => {
    const owner = await getStorageOwner({ database, auth, workspaceID, ...input, lock: true });
    const valueSize = getStorageValueSize(input.value);
    const size = Buffer.byteLength(input.key) + valueSize;
    // Drizzle writes a JSON null as SQL NULL, so the value is written as JSON text.
    const value = sql`${JSON.stringify(input.value)}::jsonb`;

    if (valueSize > extensionStorageLimits.valueSize) {
      throw new ORPCError("BAD_REQUEST", { message: "The storage value is too large" });
    }

    const [others] = await database
      .select({
        entries: sql<number>`count(*)::int`,
        size: sql<number>`coalesce(sum(${extensionStorage.size}), 0)::int`
      })
      .from(extensionStorage)
      .where(and(eq(extensionStorage.extensionID, owner), ne(extensionStorage.key, input.key)));
    const isOverQuota =
      others.entries >= extensionStorageLimits.entries ||
      others.size + size > extensionStorageLimits.totalSize;

    if (isOverQuota) {
      throw new ORPCError("FORBIDDEN", { message: "The extension storage is full" });
    }

    const [entry] = await database
      .insert(extensionStorage)
      .values({ extensionID: owner, key: input.key, value, size })
      .onConflictDoUpdate({
        target: [extensionStorage.extensionID, extensionStorage.key],
        set: { value, size, updatedAt: sql`now()` }
      })
      .returning({ key: extensionStorage.key, updatedAt: extensionStorage.updatedAt });

    return { key: entry.key, updatedAt: entry.updatedAt.toISOString() };
  }
);

export { setEntry };
