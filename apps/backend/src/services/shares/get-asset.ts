import { withAuthorization } from "#backend/lib/policy";
import { resolveVisitorEntry, type VisitorEntry } from "#backend/lib/shares";
import { Asset } from "#backend/services/assets";

/** An image of the shared entry, through its current content only. */
const getShareAsset = withAuthorization<
  { assetID: string },
  VisitorEntry,
  Awaited<ReturnType<typeof Asset.get>>
>(
  {
    actions: ({ resolved }) => ({ entries: [{ action: "entry:read", ...resolved }] }),
    resolve: async ({ auth }) => resolveVisitorEntry(auth)
  },
  async ({ auth, authorizationScope, input, resolved }) => {
    return Asset.get({
      auth,
      assetID: input.assetID,
      entryID: resolved.entryID,
      skipAuthorization: authorizationScope
    });
  }
);

export { getShareAsset };
