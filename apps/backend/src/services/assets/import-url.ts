import { searchAssets, type AssetSearchResult } from "./search";
import { registerAsset } from "./register";
import { storeAssetUpload } from "./upload";
import { downloadImage } from "#backend/lib/assets/download";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { loadAssetWorkspace } from "#backend/lib/assets/access";
import { getAssetStorageLimit, getAssetStorageUsage } from "#backend/lib/assets/quota";
import { config } from "#backend/lib/config";
import {
  withAuthorization,
  loadEntryAuthorizationSources,
  type EntryAuthorizationSource
} from "#backend/lib/policy";
import { consumeRateLimit } from "#backend/lib/security";
import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";

interface ImportAssetURLInput {
  checkDuplicates: boolean;
  assetID: string;
  entryID: string;
  url: string;
}

const PROCESS_DOWNLOAD_LIMIT = 10;
// Bound download memory per backend process, in addition to workspace rate limits.
let activeDownloads = 0;

const importAssetURL = withAuthorization<
  ImportAssetURLInput,
  EntryAuthorizationSource[],
  { assetID: string } | { duplicate: AssetSearchResult }
>(
  {
    resolve: ({ database, workspaceID, input }) =>
      loadEntryAuthorizationSources({ database, workspaceID, entryIDs: [input.entryID] }),
    actions: ({ resolved }) => ({
      entries: resolved.map(({ collectionID }) => ({ action: "entry:update", collectionID }))
    })
  },
  async ({ input, auth, database, workspaceID }) => {
    requireAssetStorage();
    const limit = await consumeRateLimit({
      scope: "asset-url-import",
      key: workspaceID,
      limit: { max: 10, window: 60 }
    });
    const workspace = await loadAssetWorkspace(database, workspaceID);
    const availableBytes =
      getAssetStorageLimit(workspace.subscriptionPlan) -
      (await getAssetStorageUsage(database, workspaceID));

    if (!limit.allowed || activeDownloads >= PROCESS_DOWNLOAD_LIMIT)
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many image imports; try again shortly"
      });
    if (availableBytes <= 0 && !input.checkDuplicates)
      throw new ORPCError("FORBIDDEN", { message: "Workspace image storage limit reached" });

    activeDownloads++;
    try {
      const { body, filename } = await downloadImage(
        input.url,
        input.checkDuplicates
          ? config.ASSET_MAX_UPLOAD_BYTES
          : Math.min(config.ASSET_MAX_UPLOAD_BYTES, availableBytes)
      );

      const checksum = createHash("sha256").update(body).digest("hex");

      if (input.checkDuplicates) {
        const [duplicate] = await searchAssets({
          checksum,
          query: "",
          semantic: false,
          limit: 1,
          auth
        });

        if (duplicate) return { duplicate };
      }

      // Recheck authorization and reserve the exact quota after the bounded download.
      await registerAsset({
        assetID: input.assetID,
        entryID: input.entryID,
        filename,
        byteSize: body.length,
        checksum,
        auth
      });
      await storeAssetUpload({ assetID: input.assetID, body, auth });
      return { assetID: input.assetID };
    } finally {
      activeDownloads--;
    }
  }
);

export { importAssetURL };
