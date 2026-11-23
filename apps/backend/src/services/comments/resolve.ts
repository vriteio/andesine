import { retainSuggestionAssets } from "@andesine/server/assets";
import { type CommentSuggestionData, commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { getContentSnapshot } from "#backend/collaboration";
import {
  type CommentThreadTarget,
  fetchCommentThread,
  readEntryDocument,
  rebaseSuggestion,
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
    const reopened = !input.resolved && !resolved.appliedAt ? resolved.suggestion : null;
    // Resolving an auto-resolved one makes it manual, so it stays resolved.
    const isUnchanged = input.resolved === resolved.resolved && !resolved.autoResolved;

    let rebased: CommentSuggestionData | null = null;

    if (isUnchanged) {
      return {
        thread: await fetchCommentThread(database, workspaceID, resolved.threadID),
        changed: false
      };
    }

    // A reopened suggestion that can't apply would auto-resolve on the next read.
    if (reopened) {
      const { document } = await readEntryDocument(
        database,
        workspaceID,
        toEntryID(resolved.entryID),
        getContentSnapshot
      );

      rebased = rebaseSuggestion(document, reopened);

      if (!rebased) {
        throw new ORPCError("CONFLICT", {
          message: "The suggestion can't apply to the current content",
          data: { hints: ["Update the suggestion for the current content, which reopens it"] }
        });
      }
    }

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      // Fails once the images' upload grant is gone.
      if (rebased) {
        await retainSuggestionAssets({
          database: transaction,
          workspaceID,
          entryID: resolved.entryID,
          blocks: rebased.blocks
        });
      }

      await transaction
        .update(commentThreads)
        .set({
          resolvedAt: input.resolved ? new Date() : null,
          autoResolved: false,
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
