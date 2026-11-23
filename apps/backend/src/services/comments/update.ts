import { comments, commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  type CommentTarget,
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  resolveCommentTarget,
  writeCommentChange
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface UpdateCommentInput {
  id: string;
  content: string;
  mentionIDs?: string[];
}

const updateComment = withAuthorization<UpdateCommentInput, CommentTarget, CommentThread>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "comment:create", collectionID: resolved.collectionID }]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentTarget(database, workspaceID, input.id);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const isAuthor = Boolean(memberID) && toUUID(memberID!) === resolved.authorID;

    if (!isAuthor) throw new ORPCError("FORBIDDEN", { message: "Only the author can edit" });

    const mentionIDs =
      input.mentionIDs && (await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs));

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
