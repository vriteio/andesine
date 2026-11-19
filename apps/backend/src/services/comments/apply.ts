import { comments, commentThreads } from "@andesine/server/database";
import { type CommentAnchor, type CommentThread } from "@andesine/contracts/entities";
import {
  toCommentThreadID,
  toEntryID,
  toUUID,
  toWorkspaceID
} from "@andesine/contracts/primitives";
import { createWebhookOperation, getWebhookActor } from "@andesine/server/webhooks/recording";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  type CommentTarget,
  fetchCommentThread,
  replaceAnchoredText,
  resolveCommentTarget,
  writeCommentChange
} from "#backend/lib/comments";
import { openDocumentContentConnection } from "#backend/collaboration";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface AppliedText {
  /** Set inside the document transaction, which can't return a value. */
  anchor?: CommentAnchor | null;
}

const applyCommentSuggestion = withAuthorization<{ id: string }, CommentTarget, CommentThread>(
  {
    actions: ({ resolved }) => ({
      entries: [
        { action: "comment:resolve", collectionID: resolved.collectionID },
        { action: "entry:update", collectionID: resolved.collectionID }
      ]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentTarget(database, workspaceID, input.id);
    }
  },
  async ({ auth, database, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const { anchor, quote, suggestion } = resolved;
    const now = new Date();
    const hasOpenSuggestion =
      suggestion !== null && !resolved.appliedAt && anchor && quote !== null;

    if (!hasOpenSuggestion) {
      throw new ORPCError("BAD_REQUEST", { message: "The comment has no open suggestion" });
    }

    // Saving the document takes the workspace lock, so it's closed after the transaction.
    const connection = await openDocumentContentConnection(
      toEntryID(resolved.entryID),
      workspaceID,
      { contributorID: memberID }
    );

    // Saves of the edit name the caller, as content updates do.
    connection.context.webhookOperationID = createWebhookOperation(toWorkspaceID(workspaceID)).id;
    connection.context.webhookActor = getWebhookActor();

    try {
      await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
        await transaction
          .update(comments)
          .set({ appliedAt: now })
          .where(eq(comments.id, resolved.commentID));
        await transaction
          .update(commentThreads)
          .set({
            resolvedAt: now,
            resolvedByID: memberID ? toUUID(memberID) : null,
            updatedAt: now
          })
          .where(eq(commentThreads.id, resolved.threadID));

        return {
          key: resolved.commentID,
          event: {
            type: "comment.thread_resolved",
            data: { threadID: toCommentThreadID(resolved.threadID), reason: "suggestion_applied" }
          },
          // Last, so a failed check or write rolls back before the text changes.
          finalize: async () => {
            const applied: AppliedText = {};

            await connection.transact((document) => {
              applied.anchor = replaceAnchoredText(document, anchor, quote, suggestion);
            });
            // Points the thread at the new text, so its old, now empty range isn't moved elsewhere.
            await transaction
              .update(commentThreads)
              .set({
                anchorStart: applied.anchor?.start ?? null,
                anchorEnd: applied.anchor?.end ?? null
              })
              .where(eq(commentThreads.id, resolved.threadID));
          }
        };
      });
    } finally {
      await connection.disconnect();
    }

    return fetchCommentThread(database, workspaceID, resolved.threadID);
  }
);

export { applyCommentSuggestion };
