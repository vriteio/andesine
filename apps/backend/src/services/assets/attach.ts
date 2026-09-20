import { eq, isNotNull } from "drizzle-orm";
import { assets, entryAssets } from "#backend/db";
import { config } from "#backend/lib/config";
import {
  loadEntryAuthorizationSources,
  type EntryAuthorizationSource,
  withAuthorization
} from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { getAsset } from "./get";

interface AttachAssetInput {
  assetID: string;
  entryID: string;
}

const attachAsset = withAuthorization<AttachAssetInput, EntryAuthorizationSource[]>(
  {
    transaction: "locked-workspace",
    resolve: ({ database, workspaceID, input }) =>
      loadEntryAuthorizationSources({ database, workspaceID, entryIDs: [input.entryID] }),
    actions: ({ resolved }) => ({
      entries: resolved.map(({ collectionID }) => ({ action: "entry:update", collectionID }))
    })
  },
  async ({ database, workspaceID, input, auth, authorizationScope }) => {
    const asset = await getAsset({
      assetID: input.assetID,
      auth,
      skipAuthorization: authorizationScope
    });
    const pendingUntil = new Date(Date.now() + config.ASSET_UPLOAD_EXPIRY_HOURS * 3600_000);

    if (asset.status !== "ready") {
      throw new ORPCError("CONFLICT", {
        message: "Image is not ready",
        data: {
          assetID: input.assetID,
          assetStatus: asset.status,
          hints: [
            asset.status === "pending"
              ? "Complete the registered upload with assets.upload, then check assets.get until it is ready."
              : asset.status === "processing"
                ? "Check assets.get until processing finishes before attaching the image."
                : "Check assets.get for failure details and register a new upload if needed."
          ]
        }
      });
    }

    await database
      .update(assets)
      .set({ unreferencedAt: null })
      .where(eq(assets.id, toUUID(input.assetID)));
    await database
      .insert(entryAssets)
      .values({
        workspaceID,
        entryID: toUUID(input.entryID),
        assetID: toUUID(input.assetID),
        pendingUntil
      })
      .onConflictDoUpdate({
        target: [entryAssets.entryID, entryAssets.assetID],
        set: { pendingUntil },
        setWhere: isNotNull(entryAssets.pendingUntil)
      });
  }
);

export { attachAsset };
