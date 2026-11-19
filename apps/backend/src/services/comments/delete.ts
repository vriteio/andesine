import { comments, commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNull, ne, or } from "drizzle-orm";
import {
  type CommentTarget,
  fetchCommentThread,
  resolveCommentTarget,
  writeCommentChange
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface DeleteCommentResult {
  deleted?: { id: string; entryID: string };
  thread?: CommentThread;
}

const deleteComment = withAuthorization<{ id: string }, CommentTarget, DeleteCommentResult>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "entry:read", collectionID: resolved.collectionID }]
    }),
    tree: true,
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentTarget(database, workspaceID, input.id);
    }
  },
  async ({ auth, authorization, database, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const isAuthor = Boolean(memberID) && toUUID(memberID!) === resolved.authorID;
    const canDeleteOwn =
      isAuthor && authorization.canEntry(resolved.collectionID, "comment:create");
    const canDeleteAny = authorization.canEntry(resolved.collectionID, "comment:resolve");

    if (!canDeleteOwn && !canDeleteAny) {
      throw new ORPCError("FORBIDDEN", { message: "Missing permission to delete the comment" });
    }

    // Stays first: later comments come after it, and deleting it deletes the thread.
    const [first] = await database
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.workspaceID, workspaceID), eq(comments.threadID, resolved.threadID)))
      .orderBy(asc(comments.createdAt), asc(comments.id))
      .limit(1);
    const isFirst = first?.id === resolved.commentID;

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      // Others' replies need the resolve permission; checked under the lock that replies also take.
      if (isFirst && !canDeleteAny) {
        const [otherReply] = await transaction
          .select({ id: comments.id })
          .from(comments)
          .where(
            and(
              eq(comments.threadID, resolved.threadID),
              or(isNull(comments.authorID), ne(comments.authorID, resolved.authorID!))
            )
          )
          .limit(1);

        if (otherReply) {
          throw new ORPCError("FORBIDDEN", {
            message: "The thread has replies by others; deleting it needs permission to resolve"
          });
        }
      }

      await (isFirst
        ? transaction.delete(commentThreads).where(eq(commentThreads.id, resolved.threadID))
        : transaction.delete(comments).where(eq(comments.id, resolved.commentID)));

      return {
        key: resolved.commentID,
        event: {
          type: "comment.deleted",
          data: {
            threadID: toCommentThreadID(resolved.threadID),
            commentID: toCommentID(resolved.commentID),
            threadDeleted: isFirst
          }
        }
      };
    });

    if (isFirst) {
      return {
        deleted: { id: toCommentThreadID(resolved.threadID), entryID: toEntryID(resolved.entryID) }
      };
    }

    return { thread: await fetchCommentThread(database, workspaceID, resolved.threadID) };
  }
);

export { deleteComment };
