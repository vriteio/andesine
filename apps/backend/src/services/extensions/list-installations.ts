import { type ExtensionInstallation } from "@andesine/contracts/extensions";
import { toExtensionID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { getExtensionState } from "#backend/lib/extensions/state";
import { and, asc, eq, gt } from "drizzle-orm";

interface ListInstallationsInput {
  /** The registry name from a verified app-level token. */
  name: string;
  after?: string;
  limit: number;
}

/** The extension's installations on this instance, including disabled and uninstalled ones. */
const listInstallations = async (
  input: ListInstallationsInput
): Promise<{ data: ExtensionInstallation[]; hasMore: boolean }> => {
  const rows = await db
    .select()
    .from(extensions)
    .where(
      and(
        eq(extensions.name, input.name),
        eq(extensions.development, false),
        ...(input.after ? [gt(extensions.id, toUUID(input.after))] : [])
      )
    )
    .orderBy(asc(extensions.id))
    .limit(input.limit + 1);

  return {
    data: rows.slice(0, input.limit).map((row) => ({
      id: toExtensionID(row.id),
      workspaceID: toWorkspaceID(row.workspaceID),
      version: row.version,
      state: getExtensionState(row)
    })),
    hasMore: rows.length > input.limit
  };
};

export { listInstallations };
