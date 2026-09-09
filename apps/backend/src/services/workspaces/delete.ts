import {
  assetStorageDeletions,
  assetUploads,
  assets,
  entries,
  entryAssets,
  entryVersionAssets,
  memberships,
  users,
  workspaces
} from "#backend/db";
import {
  getWorkspaceAssetPrefix,
  getWorkspaceAssetStagingPrefix
} from "#backend/lib/assets/storage";
import { toEntryID, toUUID, toWorkspaceID } from "#backend/lib/primitives";
import { db } from "#backend/lib/adapters";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";

interface DeleteWorkspaceResult {
  entryIDs: string[];
  workspaceID: string | null;
}

const deleteWorkspaceOperation = async (input: {
  workspaceID: string;
  userID: string;
}): Promise<DeleteWorkspaceResult> => {
  const workspaceID = toUUID(input.workspaceID);
  const userID = toUUID(input.userID);

  const result = await db.transaction(async (tx) => {
    const [workspace] = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceID))
      .for("update");

    if (!workspace) return { entryIDs: [], affectedUserIDs: [] };

    const workspaceEntries = await tx
      .select({ id: entries.id })
      .from(entries)
      .where(eq(entries.workspaceID, workspaceID));

    // Do not acquire a second workspace lock through the fallback foreign key.
    const affectedUsers = await tx
      .update(users)
      .set({ currentWorkspaceID: null, updatedAt: new Date() })
      .where(eq(users.currentWorkspaceID, workspaceID))
      .returning({ id: users.id });

    const [asset] = await tx
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.workspaceID, workspaceID))
      .limit(1);
    if (asset) {
      // Commit a cleanup record with deletion. It survives the owner and is retried by the worker.
      await tx
        .insert(assetStorageDeletions)
        .values([
          { prefix: getWorkspaceAssetPrefix(workspaceID) },
          { prefix: getWorkspaceAssetStagingPrefix(workspaceID) }
        ])
        .onConflictDoNothing();
      await tx.delete(assetUploads).where(eq(assetUploads.workspaceID, workspaceID));
      await tx.delete(entryAssets).where(eq(entryAssets.workspaceID, workspaceID));
      await tx.delete(entryVersionAssets).where(eq(entryVersionAssets.workspaceID, workspaceID));
      await tx.update(workspaces).set({ logoAssetID: null }).where(eq(workspaces.id, workspaceID));
      await tx.delete(assets).where(eq(assets.workspaceID, workspaceID));
    }
    await tx.delete(workspaces).where(eq(workspaces.id, workspaceID));

    return {
      entryIDs: workspaceEntries.map(({ id }) => toEntryID(id)),
      affectedUserIDs: affectedUsers.map(({ id }) => id)
    };
  });

  // Set each fallback after deletion, with only the destination workspace locked.
  for (const affectedUserID of result.affectedUserIDs) {
    await db.transaction(async (tx) => {
      const [fallback] = await tx
        .select({ workspaceID: workspaces.id })
        .from(memberships)
        .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceID))
        .where(and(eq(memberships.userID, affectedUserID), isNull(workspaces.deletingAt)))
        .orderBy(asc(memberships.createdAt))
        .limit(1)
        .for("key share", { of: workspaces });

      if (!fallback) return;

      await tx
        .update(users)
        .set({ currentWorkspaceID: fallback.workspaceID, updatedAt: new Date() })
        .where(and(eq(users.id, affectedUserID), isNull(users.currentWorkspaceID)));
    });
  }

  const [user] = await db
    .select({ currentWorkspaceID: users.currentWorkspaceID })
    .from(users)
    .where(eq(users.id, userID));

  return {
    entryIDs: result.entryIDs,
    workspaceID: user?.currentWorkspaceID ? toWorkspaceID(user.currentWorkspaceID) : null
  };
};
const deleteWorkspace = withAuthorization<Record<never, never>, undefined, DeleteWorkspaceResult>(
  { permissions: { session: true } },
  async ({ auth, workspaceID }) => {
    if (!auth.session?.admin) throw new ORPCError("FORBIDDEN");

    return deleteWorkspaceOperation({ userID: auth.session!.userID, workspaceID });
  }
);

export { deleteWorkspace };
