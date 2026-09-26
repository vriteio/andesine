import { type SearchInput, type SearchResult } from "@andesine/server/search";
import { loadCurrentContentPaths } from "@andesine/server/content";
import { withAuthorization } from "#backend/lib/policy";
import { createDocumentAuthorizer } from "#backend/lib/search/current-scope";
import { search } from "#backend/lib/search/retrieval";
import { toCollectionID } from "@andesine/contracts/primitives";

const searchCurrent = withAuthorization<SearchInput, undefined, SearchResult>(
  {
    permissions: { session: true, key: ["read:entries", "read:collections"] },
    tree: true
  },
  async ({ authorization, database, input, workspaceID, auth }) => {
    const paths = await loadCurrentContentPaths(database, workspaceID);
    const scopeID = paths.resolveCollection(input, false);
    const collectionID = scopeID ? toCollectionID(scopeID) : undefined;

    if (scopeID !== undefined) authorization.assertCollectionAction(scopeID, "collection:read");

    return search({
      ...input,
      collectionID,
      authorizeDocuments: createDocumentAuthorizer(authorization, database, workspaceID),
      scope: "current",
      workspaceID: auth.workspaceID,
      allowedCollectionIDs: authorization.collections.map((collection) => collection.id)
    });
  }
);

export { searchCurrent };
