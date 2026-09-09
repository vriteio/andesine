import { assetFiles, assetUploads, assets } from "#backend/db";
import { config } from "#backend/lib/config";
import type { Database } from "#backend/lib/policy";
import { eq, sql } from "drizzle-orm";

const getAssetStorageUsage = async (database: Database, workspaceID: string): Promise<number> => {
  const [files] = await database
    .select({ bytes: sql<string>`coalesce(sum(${assetFiles.byteSize}), 0)` })
    .from(assetFiles)
    .innerJoin(assets, eq(assets.id, assetFiles.assetID))
    .where(eq(assets.workspaceID, workspaceID));
  const [uploads] = await database
    .select({ bytes: sql<string>`coalesce(sum(${assetUploads.reservedBytes}), 0)` })
    .from(assetUploads)
    .where(eq(assetUploads.workspaceID, workspaceID));

  return Number(files.bytes) + Number(uploads.bytes);
};
const getAssetStorageLimit = (plan: string): number => {
  return !config.BILLING_ENABLED || plan === "pro"
    ? config.PRO_ASSET_STORAGE_BYTES
    : config.ASSET_STORAGE_BYTES;
};

export { getAssetStorageLimit, getAssetStorageUsage };
