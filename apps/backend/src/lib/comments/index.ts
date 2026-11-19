import {
  comments,
  commentThreads,
  contents,
  entries,
  type DatabaseClient
} from "@andesine/server/database";
import { type Comment, type CommentAnchor, type CommentThread } from "@andesine/contracts/entities";
import {
  toCommentID,
  toCommentThreadID,
  toEntryID,
  toMembershipID,
  toUUID
} from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { applyUpdate, Doc } from "yjs";
import { openDocumentContentConnection, readOpenDocument } from "#backend/collaboration";
import { type AnchorState, getAnchorStates } from "./anchors";

interface CommentThreadFilter {
  entryID?: string;
  threadID?: string;
  resolved?: boolean;
  /** Thread after which to continue, in creation order. */
  cursor?: string;
  /** Returns up to one more thread, to tell whether more follow. */
  limit?: number;
}
interface CommentThreadTarget {
  threadID: string;
  entryID: string;
  collectionID: string | null;
  resolved: boolean;
  anchor: CommentAnchor | null;
  quote: string | null;
}
interface CommentTarget extends CommentThreadTarget {
  commentID: string;
  authorID: string | null;
  suggestion: string | null;
  appliedAt: Date | null;
}

type CommentRow = typeof comments.$inferSelect;
type CommentThreadRow = typeof commentThreads.$inferSelect;

const toOptionalMembershipID = (id: string | null) => (id ? toMembershipID(id) : null);
const toAnchor = (row: Pick<CommentThreadRow, "anchorStart" | "anchorEnd">) => {
  return row.anchorStart && row.anchorEnd ? { start: row.anchorStart, end: row.anchorEnd } : null;
};
const mapComment = (row: CommentRow): Comment => ({
  id: toCommentID(row.id),
  threadID: toCommentThreadID(row.threadID),
  authorID: toOptionalMembershipID(row.authorID),
  content: row.content,
  mentionIDs: row.mentionIDs.map(toMembershipID),
  suggestion: row.suggestion,
  appliedAt: row.appliedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});
const mapCommentThread = (
  row: CommentThreadRow,
  threadComments: CommentRow[],
  state: AnchorState
): CommentThread => ({
  id: toCommentThreadID(row.id),
  entryID: toEntryID(row.entryID),
  blockID: row.blockID,
  anchor: state.anchor ?? toAnchor(row),
  quote: row.quote,
  status: state.status,
  text: state.text,
  authorID: toOptionalMembershipID(row.authorID),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  resolvedByID: toOptionalMembershipID(row.resolvedByID),
  createdAt: row.createdAt.toISOString(),
  comments: threadComments.map(mapComment)
});
const withEntryDocument = async <T>(
  entryID: string,
  workspaceID: string,
  callback: (document: Doc) => T
): Promise<T> => {
  const connection = await openDocumentContentConnection(entryID, workspaceID);
  let result: { value: T } | undefined;

  try {
    await connection.transact((document) => {
      result = { value: callback(document) };
    });
  } finally {
    await connection.disconnect();
  }

  if (!result) throw new Error("Failed to read collaboration document");

  return result.value;
};
/** Reads the live document only while it's open; else the stored state, without Hocuspocus. */
const readEntryDocument = async <T>(
  database: DatabaseClient,
  workspaceID: string,
  entryID: string,
  read: (document: Doc) => T
): Promise<T> => {
  const open = await readOpenDocument(entryID, workspaceID, read);

  if (open) return open.value;

  const [stored] = await database
    .select({ state: contents.state })
    .from(contents)
    .where(and(eq(contents.entryID, toUUID(entryID)), eq(contents.workspaceID, workspaceID)));

  if (!stored?.state) return withEntryDocument(entryID, workspaceID, read);

  const document = new Doc();

  try {
    applyUpdate(document, new Uint8Array(stored.state));

    return read(document);
  } finally {
    document.destroy();
  }
};
const fetchCommentThreads = async (
  database: DatabaseClient,
  workspaceID: string,
  filter: CommentThreadFilter
): Promise<CommentThread[]> => {
  const filters: SQL[] = [eq(commentThreads.workspaceID, workspaceID)];

  if (filter.entryID) filters.push(eq(commentThreads.entryID, toUUID(filter.entryID)));
  if (filter.threadID) filters.push(eq(commentThreads.id, toUUID(filter.threadID)));

  if (filter.resolved !== undefined) {
    filters.push(
      filter.resolved ? isNotNull(commentThreads.resolvedAt) : isNull(commentThreads.resolvedAt)
    );
  }

  if (filter.cursor) {
    filters.push(
      sql`(${commentThreads.createdAt}, ${commentThreads.id}) > (select previous.created_at, previous.id from comment_threads previous where previous.id = ${toUUID(filter.cursor)})`
    );
  }

  const threadQuery = database
    .select()
    .from(commentThreads)
    .where(and(...filters))
    .orderBy(asc(commentThreads.createdAt), asc(commentThreads.id))
    .$dynamic();
  const threadRows = await (filter.limit === undefined
    ? threadQuery
    : threadQuery.limit(filter.limit + 1));

  if (!threadRows.length) return [];

  const commentRows = await database
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.workspaceID, workspaceID),
        inArray(
          comments.threadID,
          threadRows.map(({ id }) => id)
        )
      )
    )
    .orderBy(asc(comments.createdAt), asc(comments.id));
  const commentsByThreadID = new Map<string, CommentRow[]>();

  for (const row of commentRows) {
    commentsByThreadID.set(row.threadID, [...(commentsByThreadID.get(row.threadID) || []), row]);
  }

  // Threads of one call share an entry: the filter has an entry or a single thread.
  const states = await readEntryDocument(
    database,
    workspaceID,
    toEntryID(threadRows[0].entryID),
    (document) => {
      return getAnchorStates(
        document,
        threadRows.map((row) => ({ ...row, anchor: toAnchor(row) }))
      );
    }
  );

  // Stores anchors found again by their quotes, so the next read resolves them directly.
  for (const [index, { anchor }] of states.entries()) {
    if (!anchor) continue;

    await database
      .update(commentThreads)
      .set({ anchorStart: anchor.start, anchorEnd: anchor.end })
      .where(eq(commentThreads.id, threadRows[index].id));
  }

  return threadRows.map((row, index) => {
    return mapCommentThread(row, commentsByThreadID.get(row.id) || [], states[index]);
  });
};
const fetchCommentThread = async (
  database: DatabaseClient,
  workspaceID: string,
  threadID: string
): Promise<CommentThread> => {
  const [thread] = await fetchCommentThreads(database, workspaceID, { threadID });

  if (!thread) throw new ORPCError("NOT_FOUND", { message: "Comment thread not found" });

  return thread;
};
const resolveCommentEntry = async (
  database: DatabaseClient,
  workspaceID: string,
  entryID: string
): Promise<{ collectionID: string | null }> => {
  const [entry] = await database
    .select({ collectionID: entries.collectionID })
    .from(entries)
    .where(
      and(
        eq(entries.id, toUUID(entryID)),
        eq(entries.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    );

  if (!entry) throw new ORPCError("NOT_FOUND", { message: "Entry not found" });

  return entry;
};
const threadTargetColumns = {
  threadID: commentThreads.id,
  entryID: commentThreads.entryID,
  collectionID: entries.collectionID,
  resolvedAt: commentThreads.resolvedAt,
  anchorStart: commentThreads.anchorStart,
  anchorEnd: commentThreads.anchorEnd,
  quote: commentThreads.quote
};
const resolveCommentThreadTarget = async (
  database: DatabaseClient,
  workspaceID: string,
  threadID: string
): Promise<CommentThreadTarget> => {
  const [row] = await database
    .select(threadTargetColumns)
    .from(commentThreads)
    .innerJoin(entries, eq(entries.id, commentThreads.entryID))
    .where(
      and(
        eq(commentThreads.id, toUUID(threadID)),
        eq(commentThreads.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    );

  if (!row) throw new ORPCError("NOT_FOUND", { message: "Comment thread not found" });

  const { resolvedAt, anchorStart, anchorEnd, ...target } = row;

  return { ...target, resolved: resolvedAt !== null, anchor: toAnchor({ anchorStart, anchorEnd }) };
};
const resolveCommentTarget = async (
  database: DatabaseClient,
  workspaceID: string,
  commentID: string
): Promise<CommentTarget> => {
  const [row] = await database
    .select({
      ...threadTargetColumns,
      commentID: comments.id,
      authorID: comments.authorID,
      suggestion: comments.suggestion,
      appliedAt: comments.appliedAt
    })
    .from(comments)
    .innerJoin(commentThreads, eq(commentThreads.id, comments.threadID))
    .innerJoin(entries, eq(entries.id, commentThreads.entryID))
    .where(
      and(
        eq(comments.id, toUUID(commentID)),
        eq(comments.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    );

  if (!row) throw new ORPCError("NOT_FOUND", { message: "Comment not found" });

  const { resolvedAt, anchorStart, anchorEnd, ...target } = row;

  return {
    ...target,
    resolved: resolvedAt !== null,
    anchor: toAnchor({ anchorStart, anchorEnd })
  };
};

export {
  fetchCommentThread,
  fetchCommentThreads,
  resolveCommentEntry,
  resolveCommentTarget,
  readEntryDocument,
  resolveCommentThreadTarget
};
export { filterWorkspaceMembershipIDs } from "./mentions";
export { createAnchor, replaceAnchoredText } from "./anchors";
export { writeCommentChange } from "./webhooks";
export type { CommentTarget, CommentThreadTarget };
