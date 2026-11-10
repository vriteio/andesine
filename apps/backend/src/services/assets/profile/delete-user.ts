import { assets, assetStorageDeletions, users } from "@andesine/server/database";
import { getUserAssetPrefix, getUserAssetStagingPrefix } from "@andesine/server/assets";
import { db } from "#backend/lib/adapters/postgres";
import { toUUID } from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";

// Called only from the authenticated account-deletion hook.
const deleteUserImages = async (input: { userID: string }): Promise<void> => {
  const userID = toUUID(input.userID);
  await db.transaction(async (database) => {
    const [user] = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userID))
      .for("update");
    if (!user) return;
    await database
      .update(users)
      .set({ deletingAt: new Date(), imageAssetID: null, image: null })
      .where(eq(users.id, userID));
    await database
      .insert(assetStorageDeletions)
      .values([
        { prefix: getUserAssetPrefix(userID) },
        { prefix: getUserAssetStagingPrefix(userID) }
      ])
      .onConflictDoNothing();
    await database.delete(assets).where(eq(assets.userID, userID));
  });
};

export { deleteUserImages };
