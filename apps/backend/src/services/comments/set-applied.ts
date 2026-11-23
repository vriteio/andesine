import { commentThreads, isThreadOpen } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
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

interface SetSuggestionAppliedInput {
  id: string;
  applied: boolean;
}

/** For editors that apply the change themselves; the content isn't changed. */
const setSuggestionApplied = withAuthorization<
  SetSuggestionAppliedInput,
  CommentThreadTarget,
  CommentThread
>(
  {
    actions: ({ resolved }) => ({
      entries: [
        { action: "comment:resolve", collectionID: resolved.collectionID },
        { action: "entry:update", collectionID: resolved.collectionID }
      ]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentThreadTarget(database, workspaceID, input.id);
    }
  },
  async ({ auth, database, input, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const threadID = toCommentThreadID(resolved.threadID);
    const now = new Date();
    const state = input.applied
      ? { appliedAt: now, resolvedAt: now, resolvedByID: memberID ? toUUID(memberID) : null }
      : { appliedAt: null, resolvedAt: null, resolvedByID: null };
    const readContent = () => {
      return readEntryDocument(
        database,
        workspaceID,
        toEntryID(resolved.entryID),
        getContentSnapshot
      );
    };
    // Rebased, so the thread shows the change as applied.
    const rebased =
      input.applied && resolved.suggestion
        ? rebaseSuggestion((await readContent()).document, resolved.suggestion)
        : null;
    // A redo changes the content first, so its rebase changes nothing; the saved one stays.
    const isChange = rebased?.title
      ? rebased.title.base !== rebased.title.suggested
      : rebased && !isDeepStrictEqual(rebased.base, rebased.blocks);
    // Auto-resolved too: a read can resolve it between a redo's change and this call.
    const isChangeable = input.applied
      ? and(isNull(commentThreads.appliedAt), isThreadOpen)
      : isNotNull(commentThreads.appliedAt);

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      const [changed] = await transaction
        .update(commentThreads)
        .set({
          ...state,
          ...(isChange && { suggestion: rebased }),
          autoResolved: false,
          updatedAt: now
        })
        .where(
          and(
            eq(commentThreads.id, resolved.threadID),
            isNotNull(commentThreads.suggestion),
            isChangeable
          )
        )
        .returning({ id: commentThreads.id });

      if (!changed) {
        throw new ORPCError("CONFLICT", {
          message: input.applied ? "The suggestion isn't open" : "The suggestion isn't applied"
        });
      }

      return {
        key: resolved.threadID,
        event: input.applied
          ? { type: "comment.thread_resolved", data: { threadID, reason: "suggestion_applied" } }
          : { type: "comment.thread_reopened", data: { threadID } }
      };
    });

    return fetchCommentThread(database, workspaceID, resolved.threadID);
  }
);

export { setSuggestionApplied };
