import { comments, commentThreads } from "@andesine/server/database";
import { generateUUID } from "@andesine/server/primitives";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import {
  createAnchor,
  createTextSuggestion,
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  getCommentAuthor,
  readEntryDocument,
  resolveCommentEntry,
  writeCommentChange
} from "#backend/lib/comments";
import { withAuthorization } from "#backend/lib/policy";

interface CreateCommentThreadInput {
  entryID: string;
  blockID?: string;
  quote?: string;
  offset?: number;
  content: string;
  mentionIDs: string[];
  suggestion?: string;
}

const createCommentThread = withAuthorization<
  CreateCommentThreadInput,
  { collectionID: string | null },
  CommentThread
>(
  {
    actions: ({ input, resolved }) => ({
      entries: [
        { action: "comment:create", collectionID: resolved.collectionID, entryID: input.entryID }
      ]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentEntry(database, workspaceID, input.entryID);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const author = getCommentAuthor(auth);
    const mentionIDs = auth.visitor
      ? []
      : await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs);
    const entryID = toUUID(input.entryID);
    const threadID = generateUUID();
    const { anchor, blockID, suggestion } = await readEntryDocument(
      database,
      workspaceID,
      // The document name must be the canonical entry ID, whatever form the input has.
      toEntryID(entryID),
      (document) => {
        const created = createAnchor(document, {
          blockID: input.blockID ?? null,
          quote: input.quote,
          offset: input.offset,
          singleText: input.suggestion !== undefined
        });
        const { anchor } = created;
        const suggestion =
          anchor && input.quote !== undefined && input.suggestion !== undefined
            ? createTextSuggestion(document, anchor, input.quote, input.suggestion)
            : null;

        return { ...created, suggestion };
      }
    );

    await writeCommentChange(
      database,
      workspaceID,
      { entryID, collectionID: resolved.collectionID },
      async (transaction) => {
        await transaction.insert(commentThreads).values({
          id: threadID,
          workspaceID,
          entryID,
          blockID,
          anchorStart: anchor?.start ?? null,
          anchorEnd: anchor?.end ?? null,
          quote: input.quote ?? null,
          suggestion,
          ...author
        });

        const [comment] = await transaction
          .insert(comments)
          .values({
            workspaceID,
            threadID,
            ...author,
            content: input.content,
            mentionIDs
          })
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

export { createCommentThread };
