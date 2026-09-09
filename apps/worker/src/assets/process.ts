import { assetAnalyses, assetFiles, assets } from "@andesine/backend/db/assets";
import { assetUploads } from "@andesine/backend/db/asset-uploads";
import { entries } from "@andesine/backend/db/entries";
import { workspaces } from "@andesine/backend/db/workspaces";
import {
  getAssetPrefix,
  getAssetUploadKey,
  type AssetStorage
} from "@andesine/backend/lib/assets/storage";
import type { AssetProcessJobData } from "@andesine/backend/lib/queue/asset-jobs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { config } from "../config";
import { db } from "../database";
import { InvalidImageError, processImage } from "./process-image";

type AssetDatabase = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const loadProcessingAsset = async (database: AssetDatabase, data: AssetProcessJobData) => {
  const [row] = await database
    .select({ asset: assets, upload: assetUploads })
    .from(assets)
    .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
    .innerJoin(entries, and(eq(entries.id, assetUploads.entryID), isNull(entries.deletedAt)))
    .innerJoin(
      workspaces,
      and(eq(workspaces.id, assets.workspaceID), isNull(workspaces.deletingAt))
    )
    .where(
      and(
        eq(assets.id, data.assetID),
        eq(assets.workspaceID, data.workspaceID),
        eq(assets.status, "processing"),
        gt(assetUploads.expiresAt, new Date())
      )
    );

  return row;
};
const processAsset = async (data: AssetProcessJobData, storage: AssetStorage): Promise<void> => {
  const row = await loadProcessingAsset(db, data);
  if (!row) return;

  // Read and decode outside the workspace lock. This buffer is the exact snapshot we validate.
  const body = await storage.read(
    getAssetUploadKey(data.workspaceID, data.assetID),
    row.upload.byteSize
  );
  const checksum = createHash("sha256").update(body).digest("hex");
  let files: Awaited<ReturnType<typeof processImage>> = [];
  let failureReason: string | null = null;

  try {
    if (body.length !== row.upload.byteSize || checksum !== row.upload.expectedChecksum) {
      throw new InvalidImageError("Image bytes do not match the upload");
    }
    files = await processImage(body, config, row.upload.reservedBytes - row.upload.byteSize);
  } catch (error) {
    if (!(error instanceof InvalidImageError)) throw error;
    failureReason = error.message;
  }

  await db.transaction(async (database) => {
    const [workspace] = await database
      .select({ deletingAt: workspaces.deletingAt })
      .from(workspaces)
      .where(eq(workspaces.id, data.workspaceID))
      .for("update");

    if (!workspace || workspace.deletingAt) return;

    const current = await loadProcessingAsset(database, data);
    if (!current) return;

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

    for (const file of files) {
      const objectKey = `${getAssetPrefix(data.workspaceID, data.assetID)}${file.variant}.${file.format}`;
      await storage.put(objectKey, file.body, `image/${file.format}`);
      await database.insert(assetFiles).values({
        assetID: data.assetID,
        variant: file.variant,
        objectKey,
        format: file.format,
        byteSize: file.body.length,
        width: file.width,
        height: file.height
      });
    }

    await database
      .update(assets)
      .set({ status: "ready", sourceChecksum: checksum, updatedAt: new Date() })
      .where(eq(assets.id, data.assetID));
    await database.insert(assetAnalyses).values({ assetID: data.assetID }).onConflictDoNothing();
    // Keep the staging reservation until cleanup succeeds.
    await database
      .update(assetUploads)
      .set({ reservedBytes: row.upload.byteSize, updatedAt: new Date() })
      .where(eq(assetUploads.assetID, data.assetID));
  });
};

export { processAsset };
