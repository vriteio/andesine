import { comments, commentThreads } from "@andesine/server/database";
import { generateUUID } from "@andesine/server/primitives";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import {
  createAnchor,
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  readEntryDocument,
  resolveCommentEntry,
  writeCommentChange
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface CreateCommentThreadInput {
  entryID: string;
  blockID?: string;
  quote?: string;
  offset?: number;
  content: string;
  mentionIDs: string[];
  suggestion?: string | null;
}

const createCommentThread = withAuthorization<
  CreateCommentThreadInput,
  { collectionID: string | null },
  CommentThread
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "comment:create", collectionID: resolved.collectionID }]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentEntry(database, workspaceID, input.entryID);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const authorID = memberID ? toUUID(memberID) : null;
    const mentionIDs = await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs);
    const entryID = toUUID(input.entryID);
    const threadID = generateUUID();
    const { anchor, blockID } = await readEntryDocument(
      database,
      workspaceID,
      // The document name must be the canonical entry ID, whatever form the input has.
      toEntryID(entryID),
      (document) => {
        return createAnchor(document, {
          blockID: input.blockID ?? null,
          quote: input.quote,
          offset: input.offset,
          singleText: input.suggestion != null
        });
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
          authorID
        });

        const [comment] = await transaction
          .insert(comments)
          .values({
            workspaceID,
            threadID,
            authorID,
            content: input.content,
            mentionIDs,
            suggestion: input.suggestion ?? null
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
