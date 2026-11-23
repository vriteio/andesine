import clsx from "clsx";
import { type Editor, Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey
} from "@tiptap/y-tiptap";
import {
  createAbsolutePositionFromRelativePosition,
  decodeRelativePosition,
  type RelativePosition
} from "yjs";
import { getLinearOffset, getLinearText } from "@andesine/document/comments";
import type { EditorCommentTarget, EditorCommentThread } from "#editor/client-types";

interface CommentTextDraft {
  start: RelativePosition;
  end: RelativePosition;
}
interface CommentBlockDraft {
  blockID: string;
}
interface FoundBlock {
  pos: number;
  node: ProseMirrorNode;
}
interface HighlightTarget {
  blockID: string | null;
  start?: RelativePosition;
  end?: RelativePosition;
}
interface CommentsState {
  threads: EditorCommentThread[];
  draft: CommentTargetDraft | null;
  active: string | null;
  /** The thread whose card is under the pointer. */
  hovered: string | null;
  decorations: DecorationSet;
}
interface CommentsMeta {
  threads?: EditorCommentThread[];
  draft?: CommentTargetDraft | null;
  active?: string | null;
  hovered?: string | null;
}
interface CommentTargetDraft {
  target: EditorCommentTarget;
  draft: CommentDraft;
}
interface CommentThreadPosition {
  threadID: string;
  pos: number;
  block: boolean;
}

type CommentDraft = CommentTextDraft | CommentBlockDraft;
type YSyncState = NonNullable<ReturnType<typeof ySyncPluginKey.getState>>;

// Title suggestions anchor to the title, which has no block ID.
const TITLE_BLOCK_ID = "title";
const TABLE_NODE_TYPES = new Set(["table", "tableRow", "tableCell", "tableHeader"]);
const DRAFT_THREAD_ID = "draft";
const commentsPluginKey = new PluginKey<CommentsState>("comments");
const blocksByDoc = new WeakMap<ProseMirrorNode, Map<string, FoundBlock>>();

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const getYSync = (state: EditorState): YSyncState | null => {
  const ySync = ySyncPluginKey.getState(state);

  return ySync?.binding ? ySync : null;
};
/** The first block of a repeated ID wins; cached per (immutable) doc. */
const getBlocks = (doc: ProseMirrorNode): Map<string, FoundBlock> => {
  const cached = blocksByDoc.get(doc);

  if (cached) return cached;

  const blocks = new Map<string, FoundBlock>();

  doc.descendants((node, pos) => {
    const { id } = node.attrs;

    if (typeof id === "string" && !blocks.has(id)) blocks.set(id, { pos, node });
  });
  blocksByDoc.set(doc, blocks);

  return blocks;
};
const getAnchorBlockIDs = ({ suggestion, blockID }: EditorCommentThread, hasRange: boolean) => {
  // An insertion at the start goes after the title, which anchors it.
  const isAtStart = suggestion && !suggestion.blockIDs.length && !suggestion.after;

  if (suggestion?.title || isAtStart) return [TITLE_BLOCK_ID];

  return !hasRange && suggestion?.blockIDs.length ? suggestion.blockIDs : [blockID];
};
const resolveRange = (ySync: YSyncState, start: RelativePosition, end: RelativePosition) => {
  const [from, to] = [start, end].map((position) => {
    return relativePositionToAbsolutePosition(
      ySync.doc,
      ySync.type,
      position,
      ySync.binding.mapping
    );
  });

  return from !== null && to !== null && from < to ? { from, to } : null;
};
const createHighlight = (
  state: EditorState,
  target: HighlightTarget,
  threadID: string | null,
  active: boolean,
  getBlock: (blockID: string) => FoundBlock | null,
  hovered = false
): Decoration | null => {
  const ySync = getYSync(state);
  const attributes = (className: string) => ({
    class: clsx(
      className,
      !threadID && "comment-draft",
      active && "comment-active",
      hovered && "comment-hovered"
    ),
    ...(threadID && { "data-comment-thread": threadID })
  });

  if (target.start && target.end) {
    const range = ySync && resolveRange(ySync, target.start, target.end);

    return (
      range &&
      Decoration.inline(
        range.from,
        range.to,
        { ...attributes("comment-highlight"), "data-comment-text": "" },
        { threadID }
      )
    );
  }

  const block = target.blockID ? getBlock(target.blockID) : null;
  // Tables draw theirs in the table view; rows and cells get none, as an overlay counts as a cell.
  const isTable = TABLE_NODE_TYPES.has(block?.node.type.name ?? "");

  return (
    block &&
    Decoration.node(
      block.pos,
      block.pos + block.node.nodeSize,
      isTable ? {} : attributes("comment-block-highlight"),
      { comment: threadID ? "thread" : "draft", threadID, active }
    )
  );
};
const createDecorations = (
  state: EditorState,
  threads: EditorCommentThread[],
  draft: CommentTargetDraft | null,
  active: string | null,
  hovered: string | null
): DecorationSet => {
  const getBlock = (blockID: string) => {
    const title = state.doc.firstChild;

    if (blockID === TITLE_BLOCK_ID) return title ? { pos: 0, node: title } : null;

    return getBlocks(state.doc).get(blockID) ?? null;
  };
  const highlights = threads
    .filter(({ resolved }) => !resolved)
    .flatMap((thread) => {
      const anchor = thread.anchor && {
        start: decodeRelativePosition(decodeBase64(thread.anchor.start)),
        end: decodeRelativePosition(decodeBase64(thread.anchor.end))
      };
      const blockIDs = getAnchorBlockIDs(thread, Boolean(anchor));
      // Block suggestions draw their changes, so their blocks only anchor the card.
      const isShaded = thread.id === active && !(thread.suggestion && !anchor);

      return blockIDs.map((blockID) => {
        return createHighlight(
          state,
          { blockID, ...anchor },
          thread.id,
          isShaded,
          getBlock,
          thread.id === hovered
        );
      });
    });
  const draftHighlight =
    draft &&
    createHighlight(
      state,
      "blockID" in draft.draft ? draft.draft : { blockID: null, ...draft.draft },
      null,
      false,
      getBlock
    );

  return DecorationSet.create(
    state.doc,
    [...highlights, draftHighlight].filter((decoration) => decoration !== null)
  );
};
/** A thread over several ranges is at its first. */
const getCommentThreadPositions = (state: EditorState): CommentThreadPosition[] => {
  const positions = new Map<string, CommentThreadPosition>();
  const decorations = commentsPluginKey.getState(state)?.decorations.find() ?? [];

  for (const decoration of decorations) {
    const threadID = (decoration.spec.threadID as string | null) ?? DRAFT_THREAD_ID;
    const current = positions.get(threadID);

    if (current && current.pos <= decoration.from) continue;

    positions.set(threadID, {
      threadID,
      pos: decoration.from,
      block: decoration.spec.comment !== undefined
    });
  }

  return [...positions.values()];
};
/** A new active thread only restyles the highlights, so they aren't measured again. */
const changesComments = (tr: Transaction): boolean => {
  const meta = tr.getMeta(commentsPluginKey) as CommentsMeta | undefined;

  return tr.docChanged || Boolean(meta && ("threads" in meta || "draft" in meta));
};
const getCommentDraft = (state: EditorState): CommentTargetDraft | null => {
  return commentsPluginKey.getState(state)?.draft ?? null;
};
const updateComments = (editor: Editor, meta: CommentsMeta): void => {
  editor.view.dispatch(
    editor.state.tr.setMeta(commentsPluginKey, meta).setMeta("addToHistory", false)
  );
};
const getTextCommentTarget = (editor: Editor): CommentTargetDraft | null => {
  const ySync = getYSync(editor.state);

  if (!ySync) return null;

  const { from, to } = editor.state.selection;
  const linear = getLinearText(ySync.type);
  const start = absolutePositionToRelativePosition(from, ySync.type, ySync.binding.mapping);
  const end = absolutePositionToRelativePosition(to, ySync.type, ySync.binding.mapping);
  const [startOffset, endOffset] = [start, end].map((position) => {
    const absolute = createAbsolutePositionFromRelativePosition(position, ySync.doc);

    return absolute && getLinearOffset(linear, absolute.type, absolute.index);
  });
  const hasText = startOffset !== null && endOffset !== null && startOffset < endOffset;

  if (!hasText) return null;

  // The smallest block around the quote, for a short offset.
  const [blockID, block] =
    [...linear.blocks]
      .filter(([, range]) => range.start <= startOffset && endOffset <= range.end)
      .sort(([, a], [, b]) => a.end - a.start - (b.end - b.start))[0] ?? [];

  return {
    target: {
      blockID,
      quote: linear.source.slice(startOffset, endOffset),
      offset: startOffset - (block?.start ?? 0)
    },
    draft: { start, end }
  };
};
/** A block selection starts at its node. */
const getBlockCommentTarget = (editor: Editor): CommentTargetDraft | null => {
  const { doc, selection } = editor.state;
  const blockID = doc.nodeAt(selection.from)?.attrs.id as string | undefined;

  return blockID ? { target: { blockID }, draft: { blockID } } : null;
};

const Comments = Extension.create({
  name: "comments",
  addProseMirrorPlugins() {
    return [
      new Plugin<CommentsState>({
        key: commentsPluginKey,
        state: {
          init: (_, state) => ({
            threads: [],
            draft: null,
            active: null,
            hovered: null,
            decorations: DecorationSet.create(state.doc, [])
          }),
          apply: (tr, value, _, state) => {
            const meta = tr.getMeta(commentsPluginKey) as CommentsMeta | undefined;
            const threads = meta?.threads ?? value.threads;
            const draft = meta && "draft" in meta ? (meta.draft ?? null) : value.draft;
            const active = meta && "active" in meta ? (meta.active ?? null) : value.active;
            const hovered = meta && "hovered" in meta ? (meta.hovered ?? null) : value.hovered;
            // Remote changes replace the whole document, so mapping would drop every highlight.
            const isRemoteChange = Boolean(tr.getMeta(ySyncPluginKey)?.isChangeOrigin);

            if (meta || isRemoteChange) {
              return {
                threads,
                draft,
                active,
                hovered,
                decorations: createDecorations(state, threads, draft, active, hovered)
              };
            }

            return { ...value, decorations: value.decorations.map(tr.mapping, tr.doc) };
          }
        },
        props: {
          decorations: (state) => commentsPluginKey.getState(state)?.decorations
        }
      })
    ];
  }
});

export {
  changesComments,
  Comments,
  commentsPluginKey,
  DRAFT_THREAD_ID,
  getBlocks,
  getBlockCommentTarget,
  getCommentDraft,
  getCommentThreadPositions,
  getTextCommentTarget,
  updateComments
};
export type { CommentTargetDraft, CommentThreadPosition };
