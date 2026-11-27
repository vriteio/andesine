import { comments, commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID } from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";
import {
  type CommentThreadTarget,
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  getCommentAuthor,
  resolveCommentThreadTarget,
  writeCommentChange
} from "#backend/lib/comments";
import { withAuthorization } from "#backend/lib/policy";

interface ReplyToCommentThreadInput {
  threadID: string;
  content: string;
  mentionIDs: string[];
}

const replyToCommentThread = withAuthorization<
  ReplyToCommentThreadInput,
  CommentThreadTarget,
  CommentThread
>(
  {
    actions: ({ resolved }) => ({
      entries: [
        { action: "comment:create", collectionID: resolved.collectionID, entryID: resolved.entryID }
      ]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentThreadTarget(database, workspaceID, input.threadID);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const mentionIDs = auth.visitor
      ? []
      : await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs);

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      const [comment] = await transaction
        .insert(comments)
        .values({
          workspaceID,
          threadID: resolved.threadID,
          ...getCommentAuthor(auth),
          content: input.content,
          mentionIDs
        })
        .returning({ id: comments.id });

      await transaction
        .update(commentThreads)
        .set({ updatedAt: new Date() })
        .where(eq(commentThreads.id, resolved.threadID));

      return {
        key: comment.id,
        event: {
          type: "comment.created",
          data: {
            threadID: toCommentThreadID(resolved.threadID),
            commentID: toCommentID(comment.id),
            reply: true
          }
        }
      };
    });

    return fetchCommentThread(database, workspaceID, resolved.threadID);
  }
);

export { replyToCommentThread };
