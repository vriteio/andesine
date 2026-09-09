import { assets, assetUploads, users, workspaces } from "#backend/db";
import type { db } from "#backend/lib/adapters/postgres";
import { toAssetID, toUUID } from "#backend/lib/primitives";
import type { AssetOwner } from "./storage";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

interface ProfileImageAuth {
  type: "session" | "key";
  workspaceID: string;
  session?: { userID: string };
}

interface ProfileImageInput {
  target: "workspace" | "user";
}

type Database = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getProfileOwner = (
  auth: ProfileImageAuth,
  target: ProfileImageInput["target"]
): AssetOwner => {
  if (auth.type !== "session" || !auth.session) throw new ORPCError("FORBIDDEN");
  return target === "workspace"
    ? { workspaceID: toUUID(auth.workspaceID), userID: null }
    : { workspaceID: null, userID: toUUID(auth.session.userID) };
};
const profileOwnerCondition = (owner: AssetOwner) =>
  owner.workspaceID ? eq(assets.workspaceID, owner.workspaceID) : eq(assets.userID, owner.userID!);
const lockProfileOwner = async (database: Database, owner: AssetOwner) => {
  if (owner.workspaceID) {
    const [workspace] = await database
      .select({ assetID: workspaces.logoAssetID, subscriptionPlan: workspaces.subscriptionPlan })
      .from(workspaces)
      .where(and(eq(workspaces.id, owner.workspaceID), isNull(workspaces.deletingAt)))
      .for("update");
    if (!workspace) throw new ORPCError("NOT_FOUND");
    return workspace;
  }
  const [user] = await database
    .select({ assetID: users.imageAssetID })
    .from(users)
    .where(and(eq(users.id, owner.userID!), isNull(users.deletingAt)))
    .for("update");
  if (!user) throw new ORPCError("NOT_FOUND");
  return { ...user, subscriptionPlan: "free" };
};
const cancelProfileUploads = async (database: Database, owner: AssetOwner): Promise<void> => {
  const pending = await database
    .select({ id: assets.id })
    .from(assets)
    .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
    .where(
      and(
        profileOwnerCondition(owner),
        isNull(assetUploads.entryID),
        inArray(assets.status, ["pending", "processing", "ready"]),
        isNull(assets.unreferencedAt),
        sql`not exists (select 1 from ${users} where ${users.id} = ${assets.userID} and ${users.imageAssetID} = ${assets.id})`,
        sql`not exists (select 1 from ${workspaces} where ${workspaces.id} = ${assets.workspaceID} and ${workspaces.logoAssetID} = ${assets.id})`
      )
    );
  if (!pending.length) return;
  const ids = pending.map(({ id }) => id);
  await database
    .update(assets)
    .set({ status: "failed", updatedAt: new Date() })
    .where(inArray(assets.id, ids));
  await database
    .update(assetUploads)
    .set({ expiresAt: new Date(), failureReason: "Upload was replaced or canceled" })
    .where(inArray(assetUploads.assetID, ids));
};
const getProfileImageURL = (apiURL: string, assetID: string): string =>
  `${apiURL}/assets/profiles/${toAssetID(assetID)}`;

export {
  getProfileOwner,
  profileOwnerCondition,
  lockProfileOwner,
  cancelProfileUploads,
  getProfileImageURL
};
export type { ProfileImageInput };
