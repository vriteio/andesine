import { withAuthorization } from "#backend/lib/policy";
import { createDocumentAuthorizer } from "#backend/lib/search/current-scope";
import type { AskInput, AskSource } from "#backend/lib/search/query-types";
import { prepareAnswer, type PreparedAnswer } from "#backend/lib/search/answers";
import { loadCurrentContentPaths } from "#backend/lib/content/paths";
import { toCollectionID } from "#backend/lib/primitives";

const prepareCurrentAnswer = withAuthorization<AskInput, undefined, PreparedAnswer<AskSource>>(
  {
    permissions: { session: true, key: ["ai-answers", "read:entries", "read:collections"] },
    tree: true
  },
  async ({ authorization, database, input, workspaceID, auth }) => {
    const paths = await loadCurrentContentPaths(database, workspaceID);
    const scopeID = paths.resolveCollection(input, false);
    const collectionID = scopeID ? toCollectionID(scopeID) : undefined;

    if (scopeID !== undefined) authorization.assertCollectionAction(scopeID, "collection:read");

    return prepareAnswer({
      ...input,
      collectionID,
      authorizeDocuments: createDocumentAuthorizer(authorization, database, workspaceID),
      query: input.question,
      scope: "current",
      workspaceID: auth.workspaceID,
      allowedCollectionIDs: authorization.collections.map((collection) => collection.id)
    });
  }
);

export { prepareCurrentAnswer };
