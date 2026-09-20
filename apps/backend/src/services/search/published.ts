import { withAuthorization } from "#backend/lib/policy";
import {
  createDocumentAuthorizer,
  resolvePublishedScope
} from "#backend/lib/search/published-scope";
import type { PublishedSearchInput, PublishedSearchResult } from "#backend/lib/search/query-types";
import { search } from "#backend/lib/search/retrieval";
import { normalizePublishingChannelCode } from "#backend/lib/publishing";
import { toSnapshotID } from "#backend/lib/primitives";

const searchPublished = withAuthorization<PublishedSearchInput, undefined, PublishedSearchResult>(
  {
    permissions: { session: true, key: ["read:publishing"] }
  },
  async ({ auth, database, input, workspaceID }) => {
    const channel = normalizePublishingChannelCode(input.channel);

    const scope = await resolvePublishedScope(channel, input, database, workspaceID);

    return search({
      ...input,
      collectionID: scope.collectionID,
      snapshotID: toSnapshotID(scope.snapshotID),
      channel,
      authorizeDocuments: createDocumentAuthorizer(
        channel,
        scope.snapshotID,
        database,
        workspaceID
      ),
      scope: "published",
      workspaceID: auth.workspaceID
    });
  }
);

export { searchPublished };
