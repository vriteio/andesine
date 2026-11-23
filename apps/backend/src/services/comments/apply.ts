import { commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getContentSnapshot } from "#backend/collaboration";
import {
  type CommentThreadTarget,
  fetchCommentThread,
  rebaseSuggestion,
  resolveCommentThreadTarget,
  withEntryDocument,
  writeCommentChange
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";
import { Entries } from "#backend/services/entries";

const MAX_ATTEMPTS = 3;

const applyCommentSuggestion = withAuthorization<
  { id: string },
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
  async ({ auth, database, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const entryID = toEntryID(resolved.entryID);
    const now = new Date();
    // Claim first, so concurrent applies write once.
    const [claimed] = await database
      .update(commentThreads)
      .set({ appliedAt: now })
      .where(
        and(
          eq(commentThreads.id, resolved.threadID),
          isNotNull(commentThreads.suggestion),
          isNull(commentThreads.appliedAt)
        )
      )
      .returning({ suggestion: commentThreads.suggestion });
    const suggestion = claimed?.suggestion;

    let applied = suggestion;

    if (!suggestion) {
      throw new ORPCError("BAD_REQUEST", { message: "The thread has no open suggestion" });
    }

    try {
      // A live edit after the status check fails the hash and retries.
      for (let attempt = 1; ; attempt += 1) {
        const { document, hash } = await withEntryDocument(
          entryID,
          workspaceID,
          getContentSnapshot
        );

        const rebased = rebaseSuggestion(document, suggestion);

        if (!rebased) {
          throw new ORPCError("CONFLICT", {
            message: "The content changed since the suggestion was saved",
            data: { hints: ["Update the suggestion for the current content, or edit the entry"] }
          });
        }

        try {
          const { error } = await Entries.bulkUpdate({
            auth,
            contributorIDs: memberID ? [memberID] : [],
            items: [
              {
                id: entryID,
                expectedHash: hash,
                ...(rebased.title
                  ? { name: rebased.title.suggested, expectedName: rebased.title.base }
                  : {
                      operations: [
                        {
                          type: "replaceBlocks" as const,
                          blockIDs: rebased.blockIDs,
                          after: rebased.after,
                          blocks: rebased.blocks
                        }
                      ]
                    })
              }
            ]
          });

          if (error) throw error;

          applied = rebased;
          break;
        } catch (error) {
          const isStale =
            error instanceof ORPCError &&
            error.code === "CONTENT_HASH_MISMATCH" &&
            attempt < MAX_ATTEMPTS;

          if (!isStale) throw error;
        }
      }
    } catch (error) {
      await database
        .update(commentThreads)
        .set({ appliedAt: null })
        .where(eq(commentThreads.id, resolved.threadID));

      throw error;
    }

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      await transaction
        .update(commentThreads)
        .set({
          // As applied, so the thread shows the actual change.
          suggestion: applied,
          appliedAt: now,
          resolvedAt: now,
          autoResolved: false,
          resolvedByID: memberID ? toUUID(memberID) : null,
          updatedAt: now
        })
        .where(eq(commentThreads.id, resolved.threadID));

      return {
        key: resolved.threadID,
        event: {
          type: "comment.thread_resolved",
          data: { threadID: toCommentThreadID(resolved.threadID), reason: "suggestion_applied" }
        }
      };
    });

    return fetchCommentThread(database, workspaceID, resolved.threadID);
  }
);

export { applyCommentSuggestion };
