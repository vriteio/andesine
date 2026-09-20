import { withAuthorization } from "#backend/lib/policy";
import {
  createDocumentAuthorizer,
  resolvePublishedScope
} from "#backend/lib/search/published-scope";
import type { PublishedAskInput, PublishedAskSource } from "#backend/lib/search/query-types";
import { prepareAnswer, type PreparedAnswer } from "#backend/lib/search/answers";
import { normalizePublishingChannelCode } from "#backend/lib/publishing";
import { toSnapshotID } from "#backend/lib/primitives";

const preparePublishedAnswer = withAuthorization<
  PublishedAskInput,
  undefined,
  PreparedAnswer<PublishedAskSource>
>(
  {
    permissions: { session: true, key: ["ai-answers", "read:publishing"] }
  },
  async ({ auth, database, input, workspaceID }) => {
    const channel = normalizePublishingChannelCode(input.channel);

    const scope = await resolvePublishedScope(channel, input, database, workspaceID);

    return prepareAnswer({
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
      query: input.question,
      scope: "published",
      workspaceID: auth.workspaceID
    });
  }
);

export { preparePublishedAnswer };
