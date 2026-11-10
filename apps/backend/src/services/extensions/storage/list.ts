import { extensionStorageLimits, type ExtensionStoragePage } from "@andesine/contracts/extensions";
import { extensionStorage } from "@andesine/server/database";
import { getStorageOwner } from "#backend/lib/extensions/storage";
import { withAuthorization } from "#backend/lib/policy";
import { and, asc, eq, gt, sql } from "drizzle-orm";

interface ListStorageEntriesInput {
  extensionID?: string;
  prefix?: string;
  after?: string;
  limit: number;
}

/** A page ends early at the page size, but has at least one entry. */
const listEntries = withAuthorization<ListStorageEntriesInput, undefined, ExtensionStoragePage>(
  { permissions: { session: true, extension: true } },
  async ({ auth, database, input, workspaceID }) => {
    const owner = await getStorageOwner({ database, auth, workspaceID, ...input });
    const rows = await database
      .select()
      .from(extensionStorage)
      .where(
        and(
          eq(extensionStorage.extensionID, owner),
          input.prefix ? sql`starts_with(${extensionStorage.key}, ${input.prefix})` : undefined,
          input.after ? gt(extensionStorage.key, input.after) : undefined
        )
      )
      .orderBy(asc(extensionStorage.key))
      .limit(input.limit + 1);
    const data: ExtensionStoragePage["data"] = [];

    let size = 0;

    for (const row of rows.slice(0, input.limit)) {
      size += row.size;

      if (data.length && size > extensionStorageLimits.pageSize) break;

      data.push({
        key: row.key,
        value: row.value as ExtensionStoragePage["data"][number]["value"],
        updatedAt: row.updatedAt.toISOString()
      });
    }

    return { data, hasMore: rows.length > data.length };
  }
);

export { listEntries };
