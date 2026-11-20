import { comments, commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toUUID } from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";
import {
  type CommentThreadTarget,
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  resolveCommentThreadTarget,
  writeCommentChange
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

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
      entries: [{ action: "comment:create", collectionID: resolved.collectionID }]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentThreadTarget(database, workspaceID, input.threadID);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const authorID = memberID ? toUUID(memberID) : null;
    const mentionIDs = await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs);

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      const [comment] = await transaction
        .insert(comments)
        .values({
          workspaceID,
          threadID: resolved.threadID,
          authorID,
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
