import { assets, assetStorageDeletions, users } from "#backend/db";
import { db } from "#backend/lib/adapters/postgres";
import { getUserAssetPrefix, getUserAssetStagingPrefix } from "#backend/lib/assets/storage";
import { toUUID } from "#backend/lib/primitives";
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
