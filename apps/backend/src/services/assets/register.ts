import { assetUploads, assets } from "#backend/db";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { getAssetReservationBytes } from "#backend/lib/assets/storage";
import { config } from "#backend/lib/config";
import {
  loadEntryAuthorizationSources,
  type EntryAuthorizationSource,
  withAuthorization
} from "#backend/lib/policy";
import { toAssetID, toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { loadAssetWorkspace } from "#backend/lib/assets/access";
import { getAssetStorageLimit, getAssetStorageUsage } from "#backend/lib/assets/quota";

interface RegisterAssetInput {
  assetID: string;
  entryID: string;
  filename: string;
  byteSize: number;
  checksum: string;
}
interface RegisterAssetResult {
  assetID: string;
  expiresAt: string;
}

const registerAsset = withAuthorization<
  RegisterAssetInput,
  EntryAuthorizationSource[],
  RegisterAssetResult
>(
  {
    transaction: "locked-workspace",
    resolve: ({ database, workspaceID, input }) =>
      loadEntryAuthorizationSources({ database, workspaceID, entryIDs: [input.entryID] }),
    actions: ({ resolved }) => ({
      entries: resolved.map(({ collectionID }) => ({ action: "entry:update", collectionID }))
    })
  },
  async ({ database, workspaceID, input }) => {
    requireAssetStorage();
    const workspace = await loadAssetWorkspace(database, workspaceID);
    const assetID = toUUID(input.assetID);
    const entryID = toUUID(input.entryID);
    const [existing] = await database
      .select({ asset: assets, upload: assetUploads })
      .from(assets)
      .leftJoin(assetUploads, eq(assetUploads.assetID, assets.id))
      .where(eq(assets.id, assetID));
    const filename = input.filename.trim();
    let expiresAt = new Date(Date.now() + config.ASSET_UPLOAD_EXPIRY_HOURS * 3600_000);

    if (existing) {
      const matchesUpload =
        existing.asset.workspaceID === workspaceID &&
        existing.asset.filename === filename &&
        existing.upload?.entryID === entryID &&
        existing.upload.byteSize === input.byteSize &&
        existing.upload.expectedChecksum === input.checksum &&
        existing.upload.expiresAt > new Date() &&
        existing.asset.status === "pending";
      if (!matchesUpload) {
        throw new ORPCError("CONFLICT", {
          message: "This asset ID cannot be used for this upload"
        });
      }
      expiresAt = existing.upload!.expiresAt;
    } else {
      const reservedBytes = getAssetReservationBytes(input.byteSize);
      const usedBytes = await getAssetStorageUsage(database, workspaceID);

      if (usedBytes + reservedBytes > getAssetStorageLimit(workspace.subscriptionPlan)) {
        throw new ORPCError("FORBIDDEN", { message: "Workspace image storage limit reached" });
      }

      await database.insert(assets).values({ id: assetID, workspaceID, filename });
      await database.insert(assetUploads).values({
        assetID,
        workspaceID,
        entryID,
        byteSize: input.byteSize,
        expectedChecksum: input.checksum,
        reservedBytes,
        expiresAt
      });
    }

    return {
      assetID: toAssetID(assetID),
      expiresAt: expiresAt.toISOString()
    };
  }
);

export { registerAsset };
