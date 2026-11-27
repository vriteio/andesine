import { comments, commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  type CommentTarget,
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  isCommentAuthor,
  resolveCommentTarget,
  writeCommentChange
} from "#backend/lib/comments";
import { withAuthorization } from "#backend/lib/policy";

interface UpdateCommentInput {
  id: string;
  content: string;
  mentionIDs?: string[];
}

const updateComment = withAuthorization<UpdateCommentInput, CommentTarget, CommentThread>(
  {
    actions: ({ resolved }) => ({
      entries: [
        { action: "comment:create", collectionID: resolved.collectionID, entryID: resolved.entryID }
      ]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentTarget(database, workspaceID, input.id);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    if (!isCommentAuthor(auth, resolved)) {
      throw new ORPCError("FORBIDDEN", { message: "Only the author can edit" });
    }

    const mentionIDs = auth.visitor
      ? undefined
      : input.mentionIDs && (await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs));

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      await transaction
        .update(comments)
        .set({
          content: input.content,
          // Drizzle skips undefined fields, so omitted ones stay unchanged.
          mentionIDs,
          updatedAt: new Date()
        })
        .where(eq(comments.id, resolved.commentID));
      // Bumps the thread, so a pending join sees the change.
      await transaction
        .update(commentThreads)
        .set({ updatedAt: new Date() })
        .where(eq(commentThreads.id, resolved.threadID));

      return {
        key: resolved.commentID,
        event: {
          type: "comment.updated",
          data: {
            threadID: toCommentThreadID(resolved.threadID),
            commentID: toCommentID(resolved.commentID)
          }
        }
      };
    });

    return fetchCommentThread(database, workspaceID, resolved.threadID);
  }
);

export { updateComment };
