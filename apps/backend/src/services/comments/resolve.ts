import { commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentThreadID, toUUID } from "@andesine/contracts/primitives";
import { eq } from "drizzle-orm";
import {
  type CommentThreadTarget,
  fetchCommentThread,
  resolveCommentThreadTarget,
  writeCommentChange
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface ResolveCommentThreadResult {
  thread: CommentThread;
  /** False when the thread already had the requested state. */
  changed: boolean;
}

const resolveCommentThread = withAuthorization<
  { id: string; resolved: boolean },
  CommentThreadTarget,
  ResolveCommentThreadResult
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "comment:resolve", collectionID: resolved.collectionID }]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentThreadTarget(database, workspaceID, input.id);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const threadID = toCommentThreadID(resolved.threadID);

    if (input.resolved === resolved.resolved) {
      return {
        thread: await fetchCommentThread(database, workspaceID, resolved.threadID),
        changed: false
      };
    }

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      await transaction
        .update(commentThreads)
        .set({
          resolvedAt: input.resolved ? new Date() : null,
          resolvedByID: input.resolved && memberID ? toUUID(memberID) : null,
          updatedAt: new Date()
        })
        .where(eq(commentThreads.id, resolved.threadID));

      return {
        key: resolved.threadID,
        event: input.resolved
          ? { type: "comment.thread_resolved", data: { threadID, reason: "resolved" } }
          : { type: "comment.thread_reopened", data: { threadID } }
      };
    });

    return {
      thread: await fetchCommentThread(database, workspaceID, resolved.threadID),
      changed: true
    };
  }
);

export { resolveCommentThread };
