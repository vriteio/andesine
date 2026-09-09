import { assets, assetUploads, users, workspaces } from "#backend/db";
import { auth as authAdapter } from "#backend/lib/adapters/auth";
import {
  getProfileImageURL,
  getProfileOwner,
  lockProfileOwner,
  profileOwnerCondition,
  type ProfileImageInput
} from "#backend/lib/assets/profiles";
import { config } from "#backend/lib/config";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID, toWorkspaceID } from "#backend/lib/primitives";
import { emitWorkspaceStateEvent } from "#backend/events/workspaces";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNull } from "drizzle-orm";

interface SetProfileImageInput extends ProfileImageInput {
  assetID: string;
}

const commitProfileImage = withAuthorization<SetProfileImageInput>(
  {
    transaction: "atomic",
    permissions: (input) => ({ session: input.target === "workspace" ? ["workspace"] : true })
  },
  async ({ database, auth, input }) => {
    const owner = getProfileOwner(auth, input.target);
    const current = await lockProfileOwner(database, owner);
    const assetID = toUUID(input.assetID);
    if (current.assetID === assetID) return;

    const [asset] = await database
      .select({ id: assets.id })
      .from(assets)
      .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
      .where(
        and(
          eq(assets.id, assetID),
          profileOwnerCondition(owner),
          eq(assets.status, "ready"),
          isNull(assets.unreferencedAt),
          isNull(assetUploads.entryID),
          gt(assetUploads.expiresAt, new Date())
        )
      );
    if (!asset)
      throw new ORPCError("CONFLICT", {
        message: "This image is unavailable or its upload was replaced"
      });

    if (owner.workspaceID) {
      await database
        .update(workspaces)
        .set({ logoAssetID: assetID, updatedAt: new Date() })
        .where(eq(workspaces.id, owner.workspaceID));
    } else {
      await database
        .update(users)
        .set({
          imageAssetID: assetID,
          image: getProfileImageURL(config.PUBLIC_API_URL, assetID),
          updatedAt: new Date()
        })
        .where(eq(users.id, owner.userID!));
    }
    await database.update(assets).set({ unreferencedAt: null }).where(eq(assets.id, assetID));
    if (current.assetID) {
      await database
        .update(assets)
        .set({ unreferencedAt: new Date(), updatedAt: new Date() })
        .where(eq(assets.id, current.assetID));
    }
  }
);
const setProfileImage = async (input: Parameters<typeof commitProfileImage>[0]): Promise<void> => {
  await commitProfileImage(input);
  if (input.target === "user") {
    // Refresh Better Auth's cached user data without overwriting a concurrent image change.
    await (
      await authAdapter.$context
    ).internalAdapter.updateUser(toUUID(input.auth.session!.userID), { updatedAt: new Date() });
  } else {
    emitWorkspaceStateEvent(toWorkspaceID(toUUID(input.auth.workspaceID)), {
      action: "workspace:update",
      data: { id: input.auth.workspaceID }
    });
  }
};

export { setProfileImage };
