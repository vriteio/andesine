import { memberships } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { toUUID } from "@andesine/contracts/primitives";
import { and, eq, inArray } from "drizzle-orm";

/** Keeps the mentioned IDs of workspace members, as UUIDs. */
const filterWorkspaceMembershipIDs = async (
  workspaceID: string,
  mentionIDs: string[]
): Promise<string[]> => {
  if (mentionIDs.length === 0) return [];

  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceID, workspaceID),
        inArray(memberships.id, [...new Set(mentionIDs.map(toUUID))])
      )
    );

  return rows.map(({ id }) => id);
};

export { filterWorkspaceMembershipIDs };
