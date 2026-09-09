import { assets, assetFiles } from "@andesine/backend/db/assets";
import { assetUploads } from "@andesine/backend/db/asset-uploads";
import {
  ASSET_PROFILE_SIZE,
  getOwnedAssetPrefix,
  getOwnedAssetUploadKey,
  type AssetStorage
} from "@andesine/backend/lib/assets/storage";
import { lockProfileOwner } from "@andesine/backend/lib/assets/profiles";
import type { ProfileImageJobData } from "@andesine/backend/lib/queue/asset-jobs";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../database";
import { config } from "../config";
import { InvalidImageError, processImage } from "./process-image";

const processProfileImage = async (
  data: ProfileImageJobData,
  storage: AssetStorage
): Promise<void> => {
  const [row] = await db
    .select({ asset: assets, upload: assetUploads })
    .from(assets)
    .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
    .where(
      and(
        eq(assets.id, data.assetID),
        eq(assets.status, "processing"),
        isNull(assetUploads.entryID),
        gt(assetUploads.expiresAt, new Date())
      )
    );
  if (!row) return;

  const owner = { workspaceID: row.asset.workspaceID, userID: row.asset.userID };
  const body = await storage.read(getOwnedAssetUploadKey(owner, data.assetID), row.upload.byteSize);
  const checksum = createHash("sha256").update(body).digest("hex");
  let files: Awaited<ReturnType<typeof processImage>> = [];
  let failureReason: string | null = null;

  try {
    if (body.length !== row.upload.byteSize || checksum !== row.upload.expectedChecksum) {
      throw new InvalidImageError("Image bytes do not match the upload");
    }
    files = await processImage(
      body,
      config,
      row.upload.reservedBytes - row.upload.byteSize,
      ASSET_PROFILE_SIZE
    );
  } catch (error) {
    if (!(error instanceof InvalidImageError)) throw error;
    failureReason = error.message;
  }

  await db.transaction(async (database) => {
    await lockProfileOwner(database, owner);
    const [pending] = await database
      .select({ id: assets.id })
      .from(assets)
      .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
      .where(
        and(
          eq(assets.id, data.assetID),
          eq(assets.status, "processing"),
          isNull(assetUploads.entryID),
          gt(assetUploads.expiresAt, new Date())
        )
      );
    if (!pending) return;

    if (failureReason) {
      await database
        .update(assets)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(assets.id, data.assetID));
      await database
        .update(assetUploads)
        .set({ failureReason, updatedAt: new Date() })
        .where(eq(assetUploads.assetID, data.assetID));
      return;
    }

    const file = files[0];
    const objectKey = `${getOwnedAssetPrefix(owner, data.assetID)}display.${file.format}`;
    await storage.put(objectKey, file.body, `image/${file.format}`);
    await database.insert(assetFiles).values({
      assetID: data.assetID,
      variant: "display",
      objectKey,
      format: file.format,
      byteSize: file.body.length,
      width: file.width,
      height: file.height
    });
    await database
      .update(assets)
      .set({ status: "ready", sourceChecksum: checksum, updatedAt: new Date() })
      .where(eq(assets.id, data.assetID));
    await database
      .update(assetUploads)
      .set({ reservedBytes: row.upload.byteSize, updatedAt: new Date() })
      .where(eq(assetUploads.assetID, data.assetID));
  });
};

export { processProfileImage };
