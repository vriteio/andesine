import { assets, assetUploads } from "#backend/db";
import { requireAssetStorage } from "#backend/lib/assets/client";
import {
  cancelProfileUploads,
  getProfileOwner,
  lockProfileOwner,
  type ProfileImageInput
} from "#backend/lib/assets/profiles";
import { getAssetStorageLimit, getAssetStorageUsage } from "#backend/lib/assets/quota";
import {
  getOwnedAssetUploadKey,
  getProfileImageReservationBytes
} from "#backend/lib/assets/storage";
import { config } from "#backend/lib/config";
import { withAuthorization } from "#backend/lib/policy";
import { toAssetID, toUUID } from "#backend/lib/primitives";
import { enqueueProfileImageProcessing } from "#backend/lib/queue/assets";
import { ORPCError } from "@orpc/server";
import { createHash } from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";

interface UploadProfileImageInput extends ProfileImageInput {
  assetID: string;
  filename: string;
  body: Buffer;
}

const commitProfileImage = withAuthorization<
  UploadProfileImageInput,
  undefined,
  { assetID: string }
>(
  {
    transaction: "atomic",
    permissions: (input) => ({ session: input.target === "workspace" ? ["workspace"] : true })
  },
  async ({ database, auth, input }) => {
    requireAssetStorage();
    const owner = getProfileOwner(auth, input.target);
    const profile = await lockProfileOwner(database, owner);
    const assetID = toUUID(input.assetID);
    const byteSize = input.body.length;
    const checksum = createHash("sha256").update(input.body).digest("hex");
    const [existing] = await database.select().from(assets).where(eq(assets.id, assetID));

    if (existing)
      throw new ORPCError("CONFLICT", { message: "Register a new image for this upload" });
    if (!byteSize || byteSize > config.ASSET_MAX_UPLOAD_BYTES)
      throw new ORPCError("BAD_REQUEST", { message: "Image file is too large or empty" });

    const reservedBytes = getProfileImageReservationBytes(byteSize);
    if (owner.workspaceID) {
      const usedBytes = await getAssetStorageUsage(database, owner.workspaceID);
      if (usedBytes + reservedBytes > getAssetStorageLimit(profile.subscriptionPlan)) {
        throw new ORPCError("FORBIDDEN", { message: "Workspace image storage limit reached" });
      }
    }

    await cancelProfileUploads(database, owner);
    await database.insert(assets).values({
      id: assetID,
      ...owner,
      filename: input.filename.trim().slice(0, 255) || "image",
      status: "pending"
    });
    await database.insert(assetUploads).values({
      assetID,
      workspaceID: owner.workspaceID,
      entryID: null,
      byteSize,
      expectedChecksum: checksum,
      reservedBytes,
      expiresAt: new Date(Date.now() + config.ASSET_UPLOAD_EXPIRY_HOURS * 3600_000)
    });
    return { assetID };
  }
);
const storeProfileImage = withAuthorization<UploadProfileImageInput>(
  {
    transaction: "atomic",
    permissions: (input) => ({ session: input.target === "workspace" ? ["workspace"] : true })
  },
  async ({ database, auth, input }) => {
    const owner = getProfileOwner(auth, input.target);
    await lockProfileOwner(database, owner);
    const assetID = toUUID(input.assetID);
    const [asset] = await database
      .select({ asset: assets })
      .from(assets)
      .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
      .where(
        and(
          eq(assets.id, assetID),
          isNull(assetUploads.entryID),
          gt(assetUploads.expiresAt, new Date())
        )
      );
    if (
      !asset ||
      asset.asset.workspaceID !== owner.workspaceID ||
      asset.asset.userID !== owner.userID ||
      asset.asset.status !== "pending"
    ) {
      throw new ORPCError("CONFLICT", { message: "This upload was replaced or canceled" });
    }
    // Registration is already committed, so a failed storage write has an expiry record.
    await requireAssetStorage().put(
      getOwnedAssetUploadKey(owner, assetID),
      input.body,
      "application/octet-stream"
    );
    await database
      .update(assets)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(assets.id, assetID));
  }
);
const uploadProfileImage = async (input: Parameters<typeof commitProfileImage>[0]) => {
  const data = await commitProfileImage(input);
  await storeProfileImage(input);
  try {
    await enqueueProfileImageProcessing(data);
  } catch (error) {
    console.error("Failed to queue profile image; maintenance will retry", {
      error,
      assetID: data.assetID
    });
  }
  return { assetID: toAssetID(data.assetID) };
};

export { uploadProfileImage };
