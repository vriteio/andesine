import { getContentAssetIDs } from "@andesine/server/assets";
import type { ContentNode } from "@andesine/document";
import { toAssetID } from "@andesine/contracts/primitives";
import {
  loadEntryAuthorizationSources,
  type EntryAuthorizationSource,
  withAuthorization
} from "#backend/lib/policy";
import { attachAsset } from "./attach";

interface GrantContentAssetsInput {
  entryID: string;
  document: ContentNode;
  previousDocument?: ContentNode;
}

/**
 * Attaches the images that content written through the API newly references, with the checks of
 * attach: the caller can read each image and update the entry. Call it in the content
 * transaction, with `skipAuthorization` set to the caller's scope.
 */
const grantContentAssets = withAuthorization<GrantContentAssetsInput, EntryAuthorizationSource[]>(
  {
    resolve: ({ database, workspaceID, input }) =>
      loadEntryAuthorizationSources({ database, workspaceID, entryIDs: [input.entryID] }),
    tree: true
  },
  async ({ auth, authorization, authorizationScope, input, resolved }) => {
    const previousIDs = new Set(
      input.previousDocument ? getContentAssetIDs(input.previousDocument) : []
    );
    const assetIDs = getContentAssetIDs(input.document).filter((id) => !previousIDs.has(id));

    if (!assetIDs.length) return;

    // Checked even with skipped actions: images become part of the entry, also for a version.
    authorization.assertEntrySources(resolved, "entry:update");

    for (const assetID of assetIDs) {
      await attachAsset({
        auth,
        assetID: toAssetID(assetID),
        entryID: input.entryID,
        skipAuthorization: authorizationScope
      });
    }
  }
);

export { grantContentAssets };
