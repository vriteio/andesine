import { comments, commentThreads } from "@andesine/server/database";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getContentSnapshot } from "#backend/collaboration";
import {
  fetchCommentThread,
  prepareSuggestion,
  readEntryDocument,
  resolveCommentThreadTarget,
  writeCommentChange,
  type CommentThreadTarget,
  type SuggestionPatch
} from "#backend/lib/comments";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";

interface UpdateSuggestionInput extends SuggestionPatch {
  id: string;
}

const noOpenSuggestionError = () => {
  return new ORPCError("BAD_REQUEST", { message: "The thread has no open suggestion" });
};
const updateSuggestion = withAuthorization<
  UpdateSuggestionInput,
  CommentThreadTarget,
  CommentThread
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "comment:create", collectionID: resolved.collectionID }]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentThreadTarget(database, workspaceID, input.id);
    },
    tree: true
  },
  async ({ auth, authorization, database, input, resolved, workspaceID }) => {
    const memberID = getUserAuthorization(auth)?.memberID;
    const isAuthor = Boolean(memberID) && toUUID(memberID!) === resolved.threadAuthorID;
    const isOpen = resolved.suggestion && !resolved.resolved && !resolved.appliedAt;

    if (!isAuthor) throw new ORPCError("FORBIDDEN", { message: "Only the author can edit" });

    if (!isOpen) throw noOpenSuggestionError();

    const { document } = await readEntryDocument(
      database,
      workspaceID,
      toEntryID(resolved.entryID),
      getContentSnapshot
    );
    const suggestion = await prepareSuggestion(database, workspaceID, {
      entryID: toEntryID(resolved.entryID),
      schemaRevisionID: resolved.schemaRevisionID,
      authorization,
      document,
      patch: input
    });

    await writeCommentChange(database, workspaceID, resolved, async (transaction) => {
      const [comment] = await transaction
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.threadID, resolved.threadID))
        .orderBy(asc(comments.createdAt), asc(comments.id))
        .limit(1);

      const [updated] = await transaction
        .update(commentThreads)
        .set({
          blockID: suggestion.blockIDs[0] ?? suggestion.after,
          suggestion,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(commentThreads.id, resolved.threadID),
            isNull(commentThreads.appliedAt),
            isNull(commentThreads.resolvedAt)
          )
        )
        .returning({ id: commentThreads.id });

      if (!updated) throw noOpenSuggestionError();

      return {
        key: comment.id,
        event: {
          type: "comment.updated",
          data: {
            threadID: toCommentThreadID(resolved.threadID),
            commentID: toCommentID(comment.id)
          }
        }
      };
    });

    return fetchCommentThread(database, workspaceID, resolved.threadID);
  }
);

export { updateSuggestion };
