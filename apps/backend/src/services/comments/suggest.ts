import { comments, commentThreads } from "@andesine/server/database";
import { generateUUID } from "@andesine/server/primitives";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { getContentSnapshot } from "#backend/collaboration";
import {
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  prepareSuggestion,
  readEntryDocument,
  resolveCommentEntry,
  writeCommentChange,
  type CommentEntryTarget,
  type SuggestionPatch
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface SuggestInput extends SuggestionPatch {
  entryID: string;
  content: string;
  mentionIDs: string[];
}

const suggestChange = withAuthorization<SuggestInput, CommentEntryTarget, CommentThread>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "comment:create", collectionID: resolved.collectionID }]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentEntry(database, workspaceID, input.entryID);
    },
    tree: true
  },
  async ({ auth, authorization, database, input, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const authorID = memberID ? toUUID(memberID) : null;
    const mentionIDs = await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs);
    const entryID = toUUID(input.entryID);
    const threadID = generateUUID();
    const { document } = await readEntryDocument(
      database,
      workspaceID,
      toEntryID(entryID),
      getContentSnapshot
    );
    const suggestion = await prepareSuggestion(database, workspaceID, {
      entryID: toEntryID(entryID),
      schemaRevisionID: resolved.schemaRevisionID,
      authorization,
      document,
      patch: input
    });

    await writeCommentChange(
      database,
      workspaceID,
      { entryID, collectionID: resolved.collectionID },
      async (transaction) => {
        await transaction.insert(commentThreads).values({
          id: threadID,
          workspaceID,
          entryID,
          blockID: suggestion.blockIDs[0] ?? suggestion.after,
          suggestion,
          authorID
        });

        const [comment] = await transaction
          .insert(comments)
          .values({ workspaceID, threadID, authorID, content: input.content, mentionIDs })
          .returning({ id: comments.id });

        return {
          key: comment.id,
          event: {
            type: "comment.created",
            data: {
              threadID: toCommentThreadID(threadID),
              commentID: toCommentID(comment.id),
              reply: false
            }
          }
        };
      }
    );

    return fetchCommentThread(database, workspaceID, threadID);
  }
);

export { suggestChange };
