import { assets } from "#backend/db";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { getAssetUploadKey } from "#backend/lib/assets/storage";
import { withAuthorization } from "#backend/lib/policy";
import { enqueueAssetProcessing } from "#backend/lib/queue/assets";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { loadAssetUpload, type AssetInput } from "#backend/lib/assets/access";

interface StoreAssetUploadInput extends AssetInput {
  body: Buffer;
}
interface StoredAssetUpload {
  assetID: string;
  workspaceID: string;
}

type ResolvedAssetUpload = Awaited<ReturnType<typeof loadAssetUpload>>;

const commitAssetUpload = withAuthorization<
  StoreAssetUploadInput,
  ResolvedAssetUpload,
  StoredAssetUpload
>(
  {
    transaction: "locked-workspace",
    resolve: loadAssetUpload,
    actions: ({ resolved }) => ({
      entries: [{ action: "entry:update", collectionID: resolved.collectionID }]
    })
  },
  async ({ database, workspaceID, input, resolved }) => {
    const storage = requireAssetStorage();
    const assetID = resolved.asset.id;
    const checksum = createHash("sha256").update(input.body).digest("hex");

    if (
      input.body.length !== resolved.upload.byteSize ||
      checksum !== resolved.upload.expectedChecksum
    ) {
      throw new ORPCError("BAD_REQUEST", { message: "Image bytes do not match the upload" });
    }

    // Retrying the same bytes is safe, but processing and ready files cannot be overwritten.
    if (["processing", "ready"].includes(resolved.asset.status)) return { assetID, workspaceID };
    if (resolved.asset.status !== "pending") {
      throw new ORPCError("CONFLICT", { message: "Register a new upload to replace this image" });
    }

    // Coordinate the storage write with expiry cleanup, retries, and workspace deletion.
    await storage.put(
      getAssetUploadKey(workspaceID, assetID),
      input.body,
      "application/octet-stream"
    );
    await database
      .update(assets)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(assets.id, assetID));
    return { assetID, workspaceID };
  }
);
const storeAssetUpload = async (input: Parameters<typeof commitAssetUpload>[0]): Promise<void> => {
  const data = await commitAssetUpload(input);
  try {
    await enqueueAssetProcessing(data);
  } catch (error) {
    console.error("Failed to enqueue image processing; recovery will retry", {
      assetID: data.assetID,
      error
    });
  }
};

export { storeAssetUpload };
