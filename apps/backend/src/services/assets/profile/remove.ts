import { auth as authAdapter } from "#backend/lib/adapters/auth";
import { emitWorkspaceStateEvent } from "#backend/events/workspaces";
import { toUUID } from "#backend/lib/primitives";
import { assets, users, workspaces } from "#backend/db";
import {
  cancelProfileUploads,
  getProfileOwner,
  lockProfileOwner,
  type ProfileImageInput
} from "#backend/lib/assets/profiles";
import { withAuthorization } from "#backend/lib/policy";
import { eq } from "drizzle-orm";

const commitProfileRemoval = withAuthorization<ProfileImageInput>(
  {
    transaction: "atomic",
    permissions: (input) => ({ session: input.target === "workspace" ? ["workspace"] : true })
  },
  async ({ database, auth, input }) => {
    const owner = getProfileOwner(auth, input.target);
    const current = await lockProfileOwner(database, owner);
    await cancelProfileUploads(database, owner);
    if (owner.workspaceID) {
      await database
        .update(workspaces)
        .set({ logoAssetID: null, updatedAt: new Date() })
        .where(eq(workspaces.id, owner.workspaceID));
    } else {
      await database
        .update(users)
        .set({ imageAssetID: null, image: null, updatedAt: new Date() })
        .where(eq(users.id, owner.userID!));
    }
    if (current.assetID) {
      await database
        .update(assets)
        .set({ unreferencedAt: new Date(), updatedAt: new Date() })
        .where(eq(assets.id, current.assetID));
    }
  }
);

const removeProfileImage = async (
  input: Parameters<typeof commitProfileRemoval>[0]
): Promise<void> => {
  await commitProfileRemoval(input);
  if (input.target === "user") {
    await (
      await authAdapter.$context
    ).internalAdapter.updateUser(toUUID(input.auth.session!.userID), { updatedAt: new Date() });
  } else {
    emitWorkspaceStateEvent(input.auth.workspaceID, {
      action: "workspace:update",
      data: { id: input.auth.workspaceID }
    });
  }
};

export { removeProfileImage };
