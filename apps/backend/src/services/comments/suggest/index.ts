import { retainSuggestionAssets } from "@andesine/server/assets";
import { comments, commentThreads, isThreadUpdatedAt } from "@andesine/server/database";
import { generateUUID } from "@andesine/server/primitives";
import { type CommentThread } from "@andesine/contracts/entities";
import { toCommentID, toCommentThreadID, toEntryID, toUUID } from "@andesine/contracts/primitives";
import { and, eq, isNull } from "drizzle-orm";
import { getContentSnapshot } from "#backend/collaboration";
import {
  fetchCommentThread,
  filterWorkspaceMembershipIDs,
  getCommentAuthor,
  prepareSuggestion,
  readEntryDocument,
  resolveCommentEntry,
  writeCommentChange,
  type CommentEntryTarget,
  type SuggestionPatch
} from "#backend/lib/comments";
import { createEmptyCollectionTree, withAuthorization } from "#backend/lib/policy";
import { findJoinedSuggestion } from "./join";

interface SuggestInput extends SuggestionPatch {
  entryID: string;
  content: string;
  mentionIDs: string[];
}

const suggestChange = withAuthorization<SuggestInput, CommentEntryTarget, CommentThread>(
  {
    actions: ({ input, resolved }) => ({
      entries: [
        { action: "comment:create", collectionID: resolved.collectionID, entryID: input.entryID }
      ]
    }),
    resolve: ({ database, input, workspaceID }) => {
      return resolveCommentEntry(database, workspaceID, input.entryID);
    },
    tree: true
  },
  async ({ auth, authorization, database, input, resolved, workspaceID }) => {
    const author = getCommentAuthor(auth);
    const mentionIDs = auth.visitor
      ? []
      : await filterWorkspaceMembershipIDs(workspaceID, input.mentionIDs);
    const entryID = toUUID(input.entryID);
    const target = { entryID, collectionID: resolved.collectionID };
    const threadID = generateUUID();
    const { document } = await readEntryDocument(
      database,
      workspaceID,
      toEntryID(entryID),
      getContentSnapshot
    );
    // Before the suggestion changes it.
    const current = structuredClone(document);
    const suggestion = await prepareSuggestion(database, workspaceID, {
      entryID: toEntryID(entryID),
      schemaRevisionID: resolved.schemaRevisionID,
      // Visitors can't link to the collection's other entries.
      authorization: auth.visitor ? createEmptyCollectionTree() : authorization,
      document,
      patch: input
    });
    const joined =
      (author.authorID || author.visitorID) &&
      (await findJoinedSuggestion(database, {
        workspaceID,
        entryID,
        author,
        document: current,
        suggestion
      }));

    const isJoined =
      joined &&
      (await writeCommentChange(database, workspaceID, target, async (transaction) => {
        const note = input.content.trim() ? { content: input.content, mentionIDs } : null;
        const [updated] = await transaction
          .update(commentThreads)
          .set({
            blockID: joined.suggestion.blockIDs[0] ?? joined.suggestion.after,
            suggestion: joined.suggestion,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(commentThreads.id, joined.threadID),
              isThreadUpdatedAt(joined.updatedAt),
              isNull(commentThreads.appliedAt),
              isNull(commentThreads.resolvedAt)
            )
          )
          .returning({ id: commentThreads.id });

        // Changed meanwhile; the new one gets its own thread.
        if (!updated) return null;

        await retainSuggestionAssets({
          database: transaction,
          workspaceID,
          entryID,
          blocks: joined.suggestion.blocks
        });

        if (note) {
          await transaction
            .update(comments)
            .set({ ...note, updatedAt: new Date() })
            .where(eq(comments.id, joined.commentID));
        }

        return {
          key: joined.commentID,
          event: {
            type: "comment.updated",
            data: {
              threadID: toCommentThreadID(joined.threadID),
              commentID: toCommentID(joined.commentID)
            }
          }
        };
      }));

    if (isJoined) return fetchCommentThread(database, workspaceID, joined.threadID);

    await writeCommentChange(database, workspaceID, target, async (transaction) => {
      await retainSuggestionAssets({
        database: transaction,
        workspaceID,
        entryID,
        blocks: suggestion.blocks
      });
      await transaction.insert(commentThreads).values({
        id: threadID,
        workspaceID,
        entryID,
        blockID: suggestion.blockIDs[0] ?? suggestion.after,
        suggestion,
        ...author
      });

      const [comment] = await transaction
        .insert(comments)
        .values({ workspaceID, threadID, ...author, content: input.content, mentionIDs })
        .returning({ id: comments.id });

      return {
        key: comment.id,
        event: {
          type: "comment.created",
          data: {
            threadID: toCommentThreadID(threadID),
            commentID: toCommentID(comment.id),
            reply: false
          }
        }
      };
    });

    return fetchCommentThread(database, workspaceID, threadID);
  }
);

export { suggestChange };
