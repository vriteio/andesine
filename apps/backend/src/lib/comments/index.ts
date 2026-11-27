import {
  comments,
  commentThreads,
  contents,
  entries,
  type CommentSuggestionData,
  type DatabaseClient,
  type DatabaseTransaction,
  isThreadOpen,
  isThreadUpdatedAt
} from "@andesine/server/database";
import {
  type Comment,
  type CommentAnchor,
  type CommentThread,
  type Visitor
} from "@andesine/contracts/entities";
import {
  toCommentID,
  toCommentThreadID,
  toEntryID,
  toMembershipID,
  toUUID
} from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { applyUpdate, Doc } from "yjs";
import {
  getContentSnapshot,
  openDocumentContentConnection,
  readOpenDocument
} from "#backend/collaboration";
import { type AnchorState, getAnchorStates } from "./anchors";
import { loadVisitors } from "./authors";
import { getStaleStatus, rebaseSuggestion } from "./suggestions";
import { type CommentChange, writeCommentChange } from "./webhooks";

interface CommentThreadFilter {
  entryID?: string;
  threadID?: string;
  resolved?: boolean;
  /** Thread after which to continue, in creation order. */
  cursor?: string;
  /** Returns up to one more thread, to tell whether more follow. */
  limit?: number;
  onChange?(thread: CommentThread): void;
}
interface CommentEntryTarget {
  collectionID: string | null;
  schemaRevisionID: string | null;
}
interface CommentThreadTarget extends CommentEntryTarget {
  threadID: string;
  entryID: string;
  threadAuthorID: string | null;
  threadVisitorID: string | null;
  resolved: boolean;
  autoResolved: boolean;
  anchor: CommentAnchor | null;
  quote: string | null;
  suggestion: CommentSuggestionData | null;
  appliedAt: Date | null;
}
interface ThreadState extends AnchorState {
  /** Rebased onto the current content. */
  suggestion?: CommentSuggestionData;
}
interface CommentTarget extends CommentThreadTarget {
  commentID: string;
  authorID: string | null;
  visitorID: string | null;
}

type CommentRow = typeof comments.$inferSelect;
type CommentThreadRow = typeof commentThreads.$inferSelect;

const toOptionalMembershipID = (id: string | null) => (id ? toMembershipID(id) : null);
const toAnchor = (row: Pick<CommentThreadRow, "anchorStart" | "anchorEnd">) => {
  return row.anchorStart && row.anchorEnd ? { start: row.anchorStart, end: row.anchorEnd } : null;
};
const getVisitor = (visitorsByID: Map<string, Visitor>, visitorID: string | null) => {
  return visitorsByID.get(visitorID ?? "") ?? null;
};
const mapComment = (row: CommentRow, visitorsByID: Map<string, Visitor>): Comment => ({
  id: toCommentID(row.id),
  threadID: toCommentThreadID(row.threadID),
  authorID: toOptionalMembershipID(row.authorID),
  visitor: getVisitor(visitorsByID, row.visitorID),
  content: row.content,
  mentionIDs: row.mentionIDs.map(toMembershipID),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});
const mapCommentThread = (
  row: CommentThreadRow,
  threadComments: CommentRow[],
  state: AnchorState,
  visitorsByID: Map<string, Visitor>
): CommentThread => ({
  id: toCommentThreadID(row.id),
  entryID: toEntryID(row.entryID),
  blockID: row.blockID,
  anchor: state.anchor ?? toAnchor(row),
  quote: row.quote,
  status: state.status,
  text: state.text,
  suggestion: row.suggestion,
  appliedAt: row.appliedAt?.toISOString() ?? null,
  authorID: toOptionalMembershipID(row.authorID),
  visitor: getVisitor(visitorsByID, row.visitorID),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  resolvedByID: toOptionalMembershipID(row.resolvedByID),
  autoResolved: row.autoResolved,
  createdAt: row.createdAt.toISOString(),
  comments: threadComments.map((comment) => mapComment(comment, visitorsByID))
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
/** Auto-resolves open suggestions that no longer apply and reopens them once they do. */
const syncAutoResolved = async (
  database: DatabaseClient,
  workspaceID: string,
  rows: CommentThreadRow[],
  states: AnchorState[]
) => {
  const now = new Date();
  const changes = new Map<string, Date | null>();

  for (const [index, row] of rows.entries()) {
    const isOpenSuggestion = row.suggestion && !row.appliedAt;
    const isActive = states[index].status === "active";
    const isResolvable = isOpenSuggestion && !row.resolvedAt && !isActive;
    const isReopenable = isOpenSuggestion && row.autoResolved && row.resolvedAt && isActive;

    if (isResolvable) changes.set(row.id, now);
    if (isReopenable) changes.set(row.id, null);
  }

  if (!changes.size) return changes;

  const { entryID } = rows[0];
  const { collectionID } = await resolveCommentEntry(database, workspaceID, entryID);
  const update = (transaction: DatabaseTransaction, resolvedAt: Date | null) => {
    const changed = rows.filter(({ id }) => changes.get(id) === resolvedAt);
    const isAsRead = changed.map(({ id, updatedAt }) => {
      return and(eq(commentThreads.id, id), isThreadUpdatedAt(updatedAt));
    });
    const isUnchanged = and(
      isNull(commentThreads.appliedAt),
      resolvedAt ? isNull(commentThreads.resolvedAt) : eq(commentThreads.autoResolved, true)
    );

    if (!changed.length) return [];

    return transaction
      .update(commentThreads)
      .set({ resolvedAt, resolvedByID: null, autoResolved: Boolean(resolvedAt), updatedAt: now })
      .where(and(or(...isAsRead), isUnchanged))
      .returning({ id: commentThreads.id, resolvedAt: commentThreads.resolvedAt });
  };

  let written = new Map<string, Date | null>();

  // One transaction, as each locks the workspace for its webhooks.
  await writeCommentChange(
    database,
    workspaceID,
    { entryID, collectionID },
    async (transaction) => {
      const updated = [...(await update(transaction, now)), ...(await update(transaction, null))];

      written = new Map(updated.map(({ id, resolvedAt }) => [id, resolvedAt]));

      return updated.map(({ id, resolvedAt }): CommentChange => {
        const threadID = toCommentThreadID(id);

        return {
          key: id,
          event: resolvedAt
            ? { type: "comment.thread_resolved", data: { threadID, reason: "suggestion_outdated" } }
            : { type: "comment.thread_reopened", data: { threadID } }
        };
      });
    }
  );

  return written;
};
const fetchCommentThreads = async (
  database: DatabaseClient,
  workspaceID: string,
  filter: CommentThreadFilter
): Promise<{ threads: CommentThread[]; nextCursor: string | null }> => {
  const filters: SQL[] = [eq(commentThreads.workspaceID, workspaceID)];

  if (filter.entryID) filters.push(eq(commentThreads.entryID, toUUID(filter.entryID)));
  if (filter.threadID) filters.push(eq(commentThreads.id, toUUID(filter.threadID)));

  // Auto-resolved too, as the read may reopen them.
  if (filter.resolved !== undefined) {
    filters.push(filter.resolved ? isNotNull(commentThreads.resolvedAt) : isThreadOpen);
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
  const rows = await (filter.limit === undefined
    ? threadQuery
    : threadQuery.limit(filter.limit + 1));
  const threadRows = rows.slice(0, filter.limit);
  // From unfiltered rows, so pages don't skip threads.
  const nextCursor =
    rows.length > threadRows.length
      ? toCommentThreadID(threadRows[threadRows.length - 1].id)
      : null;

  if (!threadRows.length) return { threads: [], nextCursor };

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
  const visitorsByID = await loadVisitors(database, [...threadRows, ...commentRows]);

  for (const row of commentRows) {
    commentsByThreadID.set(row.threadID, [...(commentsByThreadID.get(row.threadID) || []), row]);
  }

  // Threads of one call share an entry: the filter has an entry or a single thread.
  const states = await readEntryDocument(
    database,
    workspaceID,
    toEntryID(threadRows[0].entryID),
    (document) => {
      const states = getAnchorStates(
        document,
        threadRows.map((row) => ({ ...row, anchor: toAnchor(row) }))
      );
      const content = threadRows.some(({ suggestion, appliedAt }) => suggestion && !appliedAt)
        ? getContentSnapshot(document).document
        : null;

      return states.map((state, index): ThreadState => {
        const { suggestion, appliedAt } = threadRows[index];

        if (!content || !suggestion || appliedAt) return state;

        const rebased = rebaseSuggestion(content, suggestion);

        return rebased
          ? { ...state, status: "active", suggestion: rebased }
          : { ...state, status: getStaleStatus(content, suggestion) };
      });
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

  const changes = await syncAutoResolved(database, workspaceID, threadRows, states);
  const threads = threadRows.map((row, index) => {
    const { suggestion = row.suggestion } = states[index];
    const resolvedAt = changes.get(row.id);
    const isChanged = resolvedAt !== undefined;
    const resolution = isChanged
      ? { resolvedAt, resolvedByID: null, autoResolved: Boolean(resolvedAt) }
      : {};
    const thread = mapCommentThread(
      { ...row, suggestion, ...resolution },
      commentsByThreadID.get(row.id) || [],
      states[index],
      visitorsByID
    );

    if (isChanged) filter.onChange?.(thread);

    return thread;
  });

  // The read may change the resolution; a page can have fewer threads.
  const filtered = threads.filter(({ resolvedAt }) => {
    return filter.resolved === undefined || Boolean(resolvedAt) === filter.resolved;
  });

  return { threads: filtered, nextCursor };
};
const fetchCommentThread = async (
  database: DatabaseClient,
  workspaceID: string,
  threadID: string
): Promise<CommentThread> => {
  const {
    threads: [thread]
  } = await fetchCommentThreads(database, workspaceID, { threadID });

  if (!thread) throw new ORPCError("NOT_FOUND", { message: "Comment thread not found" });

  return thread;
};
const resolveCommentEntry = async (
  database: DatabaseClient,
  workspaceID: string,
  entryID: string
): Promise<CommentEntryTarget> => {
  const [entry] = await database
    .select({ collectionID: entries.collectionID, schemaRevisionID: contents.schemaRevisionID })
    .from(entries)
    .innerJoin(contents, eq(contents.entryID, entries.id))
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
  schemaRevisionID: contents.schemaRevisionID,
  threadAuthorID: commentThreads.authorID,
  threadVisitorID: commentThreads.visitorID,
  resolvedAt: commentThreads.resolvedAt,
  autoResolved: commentThreads.autoResolved,
  anchorStart: commentThreads.anchorStart,
  anchorEnd: commentThreads.anchorEnd,
  quote: commentThreads.quote,
  suggestion: commentThreads.suggestion,
  appliedAt: commentThreads.appliedAt
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
    .innerJoin(contents, eq(contents.entryID, entries.id))
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
      visitorID: comments.visitorID
    })
    .from(comments)
    .innerJoin(commentThreads, eq(commentThreads.id, comments.threadID))
    .innerJoin(entries, eq(entries.id, commentThreads.entryID))
    .innerJoin(contents, eq(contents.entryID, entries.id))
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
  resolveCommentThreadTarget,
  withEntryDocument
};
export { getCommentAuthor, isCommentAuthor } from "./authors";
export { filterWorkspaceMembershipIDs } from "./mentions";
export { createAnchor } from "./anchors";
export {
  createTextSuggestion,
  getStaleStatus,
  prepareSuggestion,
  rebaseSuggestion
} from "./suggestions";
export { writeCommentChange } from "./webhooks";
export type { SuggestionPatch } from "./suggestions";
export type { CommentAuthor } from "./authors";
export type { CommentEntryTarget, CommentTarget, CommentThreadTarget };
