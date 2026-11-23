import {
  comments,
  commentThreads,
  type CommentSuggestionData,
  type DatabaseClient
} from "@andesine/server/database";
import { type ContentNode, rebaseBlocks, rebaseText } from "@andesine/document";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { rebaseSuggestion } from "#backend/lib/comments";
import { findBlockRange } from "#backend/lib/content";

interface JoinedSuggestionTarget {
  workspaceID: string;
  entryID: string;
  authorID: string;
  /** Without the new suggestion. */
  document: ContentNode;
  suggestion: CommentSuggestionData;
}
interface JoinedSuggestion {
  threadID: string;
  commentID: string;
  updatedAt: Date;
  suggestion: CommentSuggestionData;
}

const collectIDs = (nodes: ContentNode[], ids = new Set<string>()) => {
  for (const { attrs, content } of nodes) {
    if (typeof attrs?.id === "string") ids.add(attrs.id);

    collectIDs(content ?? [], ids);
  }

  return ids;
};
/** For comparisons, as new blocks get fresh IDs. */
const stripIDs = (nodes: ContentNode[]): ContentNode[] => {
  return nodes.map(({ attrs, content, ...node }) => {
    const { id: _id, ...rest } = attrs ?? {};

    return { ...node, attrs: rest, ...(content && { content: stripIDs(content) }) };
  });
};
/** Newer joined onto older, winning on shared words; null when they don't overlap. */
const joinSuggestions = (
  document: ContentNode,
  older: CommentSuggestionData,
  newer: CommentSuggestionData
): CommentSuggestionData | null => {
  const options = { preferSuggested: true };
  const olderRange = older.blockIDs.length ? findBlockRange(document, older) : null;
  const newerRange = newer.blockIDs.length ? findBlockRange(document, newer) : null;
  const isBlocks = !older.title && !newer.title;
  const isSameInsertion =
    isBlocks && !older.blockIDs.length && !newer.blockIDs.length && older.after === newer.after;
  const isSameContainer = olderRange && newerRange?.container === olderRange.container;

  if (older.title && newer.title) {
    const { base, suggested } = newer.title;

    return {
      ...newer,
      title: { base, suggested: rebaseText(base, older.title.suggested, suggested, options)! }
    };
  }

  // Insertions at one place go one after another; a retry keeps the older one.
  if (isSameInsertion) {
    const isSame = isDeepStrictEqual(stripIDs(older.blocks), stripIDs(newer.blocks));

    return { ...newer, blocks: isSame ? older.blocks : [...older.blocks, ...newer.blocks] };
  }

  if (!olderRange || !newerRange || !isSameContainer) return null;

  const start = Math.min(olderRange.start, newerRange.start);
  const end = Math.max(olderRange.start + olderRange.count, newerRange.start + newerRange.count);
  const base = olderRange.container.slice(start, end);
  const baseIDs = collectIDs(base);
  const blockIDs = base.map(({ attrs }) => String(attrs!.id));
  const isOverlapping =
    olderRange.start < newerRange.start + newerRange.count &&
    newerRange.start < olderRange.start + olderRange.count;
  const withChange = (range: { start: number; count: number }, blocks: ContentNode[]) => {
    const from = range.start - start;

    return [...base.slice(0, from), ...blocks, ...base.slice(from + range.count)];
  };
  const hasNewBlocks = (nodes: ContentNode[]) => {
    return [...collectIDs(nodes)].some((id) => !baseIDs.has(id));
  };

  if (!isOverlapping) return null;

  const olderBlocks = withChange(olderRange, older.blocks);
  const newerBlocks = withChange(newerRange, newer.blocks);

  // A retry keeps the older blocks' IDs.
  if (isDeepStrictEqual(stripIDs(olderBlocks), stripIDs(newerBlocks))) {
    return { blockIDs, after: null, base, blocks: olderBlocks };
  }

  // New blocks of both, e.g. a split paragraph, don't pair by ID, so both would stay.
  if (hasNewBlocks(older.blocks) && hasNewBlocks(newer.blocks)) return null;

  // Null when one removes or moves blocks the other changes.
  const blocks = rebaseBlocks(base, olderBlocks, newerBlocks, options);

  return blocks && { blockIDs, after: null, base, blocks };
};
/** The author's oldest open suggestion without a note or replies that the new one joins. */
const findJoinedSuggestion = async (
  database: DatabaseClient,
  { workspaceID, entryID, authorID, document, suggestion }: JoinedSuggestionTarget
): Promise<JoinedSuggestion | null> => {
  const threads = await database
    .select({
      id: commentThreads.id,
      suggestion: commentThreads.suggestion,
      updatedAt: commentThreads.updatedAt
    })
    .from(commentThreads)
    .where(
      and(
        eq(commentThreads.workspaceID, workspaceID),
        eq(commentThreads.entryID, entryID),
        eq(commentThreads.authorID, authorID),
        isNotNull(commentThreads.suggestion),
        isNull(commentThreads.appliedAt),
        isNull(commentThreads.resolvedAt)
      )
    )
    .orderBy(asc(commentThreads.createdAt), asc(commentThreads.id));
  const threadIDs = threads.map(({ id }) => id);
  const threadComments = threads.length
    ? await database
        .select({ id: comments.id, threadID: comments.threadID, content: comments.content })
        .from(comments)
        .where(and(eq(comments.workspaceID, workspaceID), inArray(comments.threadID, threadIDs)))
    : [];

  for (const thread of threads) {
    const [comment, ...replies] = threadComments.filter(({ threadID }) => threadID === thread.id);
    const isDiscussed = !comment || replies.length > 0 || Boolean(comment.content.trim());
    const older = isDiscussed ? null : rebaseSuggestion(document, thread.suggestion!);
    const joined = older && joinSuggestions(document, older, suggestion);

    if (joined) {
      return {
        threadID: thread.id,
        commentID: comment.id,
        updatedAt: thread.updatedAt,
        suggestion: joined
      };
    }
  }

  return null;
};

export { findJoinedSuggestion };
