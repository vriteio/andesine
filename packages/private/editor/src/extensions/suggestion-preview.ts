import { Decoration, type Editor, Extension, type JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import clsx from "clsx";
import type { Component } from "solid-js";
import type { EditorCommentSuggestion, EditorCommentThread } from "#editor/client-types";
import {
  createWidgetRenderer,
  type WidgetComponentProps
} from "#editor/lib/create-widget-renderer";
import { diffBlocks, diffPair, type SuggestionMark } from "#editor/lib/suggestion-diff";
import { alignBlocks, getBlockID, isSame } from "#editor/lib/suggestion-ranges";
import { findSuggestionStart } from "#editor/lib/suggestion-apply";
import {
  getChangeAttributes,
  getChipAttributes,
  getSuggestionAttributes,
  hashContent,
  renderSuggestionBlock,
  renderSuggestionText,
  type SuggestedComment
} from "#editor/lib/suggestion-render";
import { isOpenSuggestion, rebaseSuggestion } from "#editor/lib/suggestion-status";
import { commentsPluginKey, getBlocks } from "./comments";

interface SuggestedBlockProps {
  block: JSONContent;
  threadID?: string;
  /** The current parent, which the copy diffs against. */
  base?: JSONContent;
  /** Thread IDs of changed children, by block ID. */
  changes?: Record<string, string>;
  /** Comments in the parent, which the copy draws, as the current parent is hidden. */
  comments?: SuggestedComment[];
}
interface SuggestionPreviewOptions {
  shown(): boolean;
  owner: unknown;
  /** Draws a suggested block with its node views, e.g. a code editor or an element view. */
  renderBlock: Component<SuggestedBlockProps & WidgetComponentProps> | null;
  /** Elements that only render inside their parent, e.g. a step in steps. */
  needsParent(node: JSONContent): boolean;
}
interface BlockWidgetOptions extends Omit<SuggestedBlockProps, "block"> {
  editor: Editor;
  owner: unknown;
  renderBlock: SuggestionPreviewOptions["renderBlock"];
  key: string;
  side: number;
  className: string;
}
interface PreviewContext {
  editor: Editor;
  thread: EditorCommentThread;
  options: SuggestionPreviewOptions;
  /** Whether non-suggestion comments cover a range. */
  isCommented(from: number, to: number): boolean;
  /** Opened or card-hovered; others draw faded. */
  active: boolean;
  /** Open comments on text, which a redrawn parent draws. */
  textThreads: EditorCommentThread[];
  /** Columns of the drawn suggested tables, by table ID, which suggested rows fill. */
  columns: Map<string, number>;
}
interface PreviewDraw {
  thread: EditorCommentThread;
  /** Possibly rebased onto content newer than its thread. */
  suggestion: EditorCommentSuggestion;
  from: number;
  to: number;
  /** Null when it redraws a parent, which the other suggestions in it join. */
  decorations: Decoration[] | null;
  /** What it changes, which another suggestion mustn't; its whole range when unset. */
  ranges?: Array<[number, number]>;
}
interface ParentCopy {
  suggestions: EditorCommentSuggestion[];
  commentsKey: string;
  joined: boolean[];
  base: JSONContent;
  json: JSONContent;
  changes: Record<string, string>;
  comments: SuggestedComment[];
  hash: string;
}
interface ShownMarks extends NonNullable<ReturnType<typeof findShown>> {
  marks: SuggestionMark[];
  /** The blocks it replaces, which stay the same nodes until they change. */
  nodes: ProseMirrorNode[];
}

type FoundBlocks = ReturnType<typeof getBlocks>;
type ShownMark = Extract<SuggestionMark, { from: number; change: string }>;

const contentHashes = new WeakMap<object, string>();
const parentCopies = new WeakMap<ProseMirrorNode, ParentCopy>();
// By the thread's suggestion object, which stays the same until the thread changes.
const shownMarksCache = new WeakMap<EditorCommentSuggestion, ShownMarks>();

// Blocks without node views draw as plain HTML, which is much cheaper than an editor.
const PLAIN_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "horizontalRule"
]);

/** Hashed once per object, as cached marks reuse the same JSON. */
const hashOnce = (value: object) => {
  const hash = contentHashes.get(value) ?? hashContent(value);

  contentHashes.set(value, hash);

  return hash;
};
/** Whether a block can be an editor's only content, e.g. not a list item or a table row. */
const canStandAlone = (editor: Editor, node: JSONContent) => {
  const { doc, title } = editor.schema.nodes;
  const type = editor.schema.nodes[node.type ?? ""];

  return Boolean(type && title && doc.contentMatch.matchType(title)?.matchType(type));
};
const createBlockWidget = (at: number, node: JSONContent, options: BlockWidgetOptions) => {
  const { editor, renderBlock, key, side, className, threadID, base, changes, comments } = options;
  // With a base, only an editor can mark changes inside, e.g. a heading's level.
  const isPlainType = PLAIN_BLOCK_TYPES.has(node.type ?? "") && !base;
  const isPlain = isPlainType || !canStandAlone(editor, node) || !renderBlock;

  if (isPlain) {
    const plainClass = clsx(base && "suggestion-added-block", className);
    const parsed = editor.schema.nodeFromJSON(node);
    const render = () => renderSuggestionBlock(editor.schema, parsed, plainClass, threadID);

    // Its class changes the key, as plain widgets draw again only for a new one.
    return Decoration.Widget(at, render, { key: `${key}:${className}`, side });
  }

  return createWidgetRenderer(renderBlock, {
    class: `suggestion-block ${className}`,
    attributes: getChangeAttributes(className),
    editor,
    key,
    owner: options.owner,
    pos: at,
    props: { block: node, threadID, base, changes, comments },
    side,
    tag: "div",
    stopEvent: () => true,
    ignoreSelection: true
  });
};
/** Changed content stays with comments in it; else its copy replaces it. */
const getShownClass = (mark: ShownMark, context: PreviewContext) => {
  if (mark.change !== "changed") {
    return mark.type === "text" ? "suggestion-removed" : "suggestion-removed-block";
  }

  return context.isCommented(mark.from, mark.to) ? "suggestion-commented" : "suggestion-replaced";
};
const createPreviewDecorations = (marks: SuggestionMark[], context: PreviewContext) => {
  const { editor, thread, options } = context;
  const faded = context.active ? null : "suggestion-faded";

  return marks.map((mark, index): Decoration => {
    // Keyed by content and base, as a widget draws once per key.
    const content =
      "node" in mark
        ? `${hashOnce(mark.node)}:${"base" in mark && mark.base ? hashOnce(mark.base) : ""}`
        : "";
    const key = `suggestion:${thread.id}:${index}:${content}`;
    const attributes = (className: string) => {
      return { class: clsx(className, faded), ...getSuggestionAttributes(className, thread.id) };
    };

    if (mark.type === "attributes") {
      return Decoration.Node(mark.from, mark.to, {
        "class": clsx("suggestion-attributes", faded),
        ...getChipAttributes(mark.changes),
        // The cards hit-test the ::before chip by this attribute.
        "data-suggestion-thread": thread.id
      });
    }

    if (mark.type === "code") {
      // The code editor draws the changes from the spec; only changed code opens the thread.
      return Decoration.Node(
        mark.from,
        mark.to,
        { class: clsx(faded) },
        { codeDiff: mark.changes, threadID: thread.id }
      );
    }

    if ("from" in mark) {
      const className = getShownClass(mark, context);

      return mark.type === "text"
        ? Decoration.Inline(mark.from, mark.to, attributes(className))
        : Decoration.Node(mark.from, mark.to, attributes(className));
    }

    if (mark.type === "block") {
      return createBlockWidget(mark.at, mark.node, {
        editor,
        owner: options.owner,
        renderBlock: options.renderBlock,
        key,
        // Before the block at its position, in order.
        side: -1000 + index,
        className: clsx(!mark.base && "suggestion-added-block", faded),
        threadID: thread.id,
        base: mark.base
      });
    }

    const node = editor.schema.nodeFromJSON(mark.node);
    const render = () => {
      return renderSuggestionText(editor.schema, node, clsx("suggestion-added", faded), thread.id);
    };

    return Decoration.Widget(mark.at, render, { key: `${key}:${faded}`, side: 1 });
  });
};
/** The depth of the parent to redraw, up to one that draws alone, e.g. steps for a step. */
const getParentDepth = ($start: ResolvedPos, options: SuggestionPreviewOptions) => {
  // Its type and attributes only, as its content can be large, e.g. tabs.
  const describe = (node: ProseMirrorNode) => ({ type: node.type.name, attrs: node.attrs });

  let depth = $start.depth;

  while (depth > 1 && options.needsParent(describe($start.node(depth)))) depth -= 1;

  return depth;
};
/** Applies a suggestion to blocks at any depth; false when its blocks aren't there. */
const spliceBlocks = (content: JSONContent[], suggestion: EditorCommentSuggestion): boolean => {
  const { blockIDs, after, base, blocks } = suggestion;
  const id = blockIDs[0] ?? after;
  const index = id ? content.findIndex((node) => getBlockID(node) === id) : -1;

  if (index >= 0) {
    // Copies, as a later suggestion can splice into these blocks.
    content.splice(blockIDs.length ? index : index + 1, base.length, ...structuredClone(blocks));

    return true;
  }

  return content.some((node) => Boolean(node.content && spliceBlocks(node.content, suggestion)));
};
/** [blockID, threadID] of each block a suggestion changes. */
const getChangedBlocks = ({ thread, suggestion }: PreviewDraw) => {
  return alignBlocks(suggestion.base, suggestion.blocks).flatMap(({ main, fork }) => {
    const isChanged = !main || !fork || !isSame(main, fork);
    const id = getBlockID(fork ?? main);

    return isChanged && id ? [[id, thread.id] as const] : [];
  });
};
/** A parent's copy with its suggestions; reused while the node, suggestions and comments stay. */
const getParentCopy = (
  doc: ProseMirrorNode,
  draws: PreviewDraw[],
  context: PreviewContext
): ParentCopy => {
  const [{ from, to }] = draws;
  const node = doc.nodeAt(from)!;
  const suggestions = draws.map(({ suggestion }) => suggestion);
  const commentsKey = JSON.stringify(
    context.textThreads.map(({ id, blockID, quote }) => [id, blockID, quote])
  );
  const cached = parentCopies.get(node);
  const isCached =
    cached?.commentsKey === commentsKey &&
    cached.suggestions.length === suggestions.length &&
    cached.suggestions.every((suggestion, index) => suggestion === suggestions[index]);

  if (isCached) return cached;

  const base = node.toJSON() as JSONContent;
  const json = structuredClone(base);
  const joined = suggestions.map((suggestion) => spliceBlocks(json.content ?? [], suggestion));
  const changes = Object.fromEntries(
    draws.filter((_, index) => joined[index]).flatMap(getChangedBlocks)
  );
  const blockIDs = new Set<string>();

  doc.nodesBetween(from, to, ({ attrs }) => {
    blockIDs.add(attrs.id);
  });

  const comments = context.textThreads.flatMap(({ id, blockID, quote }) => {
    return blockID && quote && blockIDs.has(blockID) ? [{ threadID: id, blockID, quote }] : [];
  });
  const hash = hashContent([json, base, changes, comments]);
  const copy = { suggestions, commentsKey, joined, base, json, changes, comments, hash };

  parentCopies.set(node, copy);

  return copy;
};
/** A parent redrawn with the suggestions in it; returns the ones that joined. */
const createParentDecorations = (
  doc: ProseMirrorNode,
  draws: PreviewDraw[],
  context: PreviewContext
) => {
  const [{ from, to }] = draws;
  const copy = getParentCopy(doc, draws, context);
  const joined = draws.filter((_, index) => copy.joined[index]);
  // The copy draws the comments in it, so the current parent hides as a whole.
  const hidden = { ...context, isCommented: () => false };
  const decorations = [
    ...createPreviewDecorations([{ type: "block", from, to, change: "changed" }], hidden),
    createBlockWidget(to, copy.json, {
      editor: context.editor,
      owner: context.options.owner,
      renderBlock: context.options.renderBlock,
      // By the parent, not its leading thread, and by content, as the copy draws once per key.
      key: `suggestion:parent:${getBlockID(copy.base)}:${copy.hash}`,
      side: -1000,
      className: clsx(!context.active && "suggestion-faded"),
      base: copy.base,
      changes: copy.changes,
      comments: copy.comments
    })
  ];

  return { joined, decorations };
};
/** A suggested title, over the current one; null once the title changed. */
const createTitleDecorations = (doc: ProseMirrorNode, context: PreviewContext) => {
  const { thread } = context;
  const node = doc.firstChild;
  // On top of the title now while typing, as the thread updates only once it stops.
  const suggestion =
    node?.textContent === thread.suggestion!.title!.base
      ? thread.suggestion!
      : rebaseSuggestion(doc, thread.suggestion!);

  if (node?.type.name !== "title" || !suggestion?.title) return null;

  const json = { type: "title", content: [{ type: "text", text: suggestion.title.suggested }] };
  const marks = diffPair(doc, 0, node.toJSON() as JSONContent, json, false);

  return {
    thread,
    suggestion,
    from: 0,
    to: node.nodeSize,
    decorations: createPreviewDecorations(marks, context)
  };
};
const getTableColumns = (nodes: JSONContent[], columns = new Map<string, number>()) => {
  for (const node of nodes) {
    const id = node.type === "table" ? getBlockID(node) : null;
    const count = Math.max(0, ...(node.content ?? []).map((row) => row.content?.length ?? 0));

    if (id) columns.set(id, Math.max(columns.get(id) ?? 0, count));

    getTableColumns(node.content ?? [], columns);
  }

  return columns;
};
/** A suggested row with empty cells for the columns that other drawn suggestions add. */
const padTableRow = (doc: ProseMirrorNode, mark: SuggestionMark, columns: Map<string, number>) => {
  const isRow = mark.type === "block" && "node" in mark && mark.node.type === "tableRow";

  if (!isRow) return mark;

  const table = doc.resolve(mark.at).parent;
  const cells = mark.node.content ?? [];
  const missing = (columns.get(table.attrs.id) ?? 0) - cells.length;
  const empty = { type: "tableCell", content: [{ type: "paragraph" }] };

  if (table.type.name !== "table" || missing <= 0) return mark;

  return { ...mark, node: { ...mark.node, content: [...cells, ...Array(missing).fill(empty)] } };
};
/** Where a suggestion's blocks are, as it saw them; null when they changed since. */
const findReplaced = (
  doc: ProseMirrorNode,
  blocks: FoundBlocks,
  suggestion: EditorCommentSuggestion
) => {
  const start = findSuggestionStart(doc, blocks, suggestion);
  const replaced: SuggestionMark[] = [];

  let end = start ?? 0;

  if (start === undefined) return null;

  for (const json of suggestion.base) {
    const node = doc.nodeAt(end);

    if (!node?.eq(doc.type.schema.nodeFromJSON(json))) return null;

    replaced.push({ type: "block", from: end, to: end + node.nodeSize, change: "changed" });
    end += node.nodeSize;
  }

  return { start, end, replaced };
};
/** The suggestion as shown, rebased while the thread lags typing; null when it can't apply. */
const findShown = (
  doc: ProseMirrorNode,
  blocks: FoundBlocks,
  suggestion: EditorCommentSuggestion
) => {
  const found = findReplaced(doc, blocks, suggestion);
  const rebased = found ? suggestion : rebaseSuggestion(doc, suggestion);
  const rebasedFound = found ?? (rebased && findReplaced(doc, blocks, rebased));

  return rebased && rebasedFound ? { suggestion: rebased, ...rebasedFound } : null;
};
const getNodesAt = (doc: ProseMirrorNode, start: number, count: number) => {
  const $start = doc.resolve(start);
  const index = $start.index();

  if (index + count > $start.parent.childCount) return null;

  return Array.from({ length: count }, (_, offset) => $start.parent.child(index + offset));
};
const shiftMark = (mark: SuggestionMark, delta: number): SuggestionMark => {
  return "at" in mark
    ? { ...mark, at: mark.at + delta }
    : { ...mark, from: mark.from + delta, to: mark.to + delta };
};
/** Reused while its blocks are the same nodes, shifted with the content before them. */
const getShownMarks = (
  doc: ProseMirrorNode,
  blocks: FoundBlocks,
  context: PreviewContext
): ShownMarks | null => {
  const suggestion = context.thread.suggestion!;
  const cached = shownMarksCache.get(suggestion);
  const start = cached && findSuggestionStart(doc, blocks, cached.suggestion);
  const nodes = cached && start !== undefined && getNodesAt(doc, start, cached.nodes.length);
  const isCached = nodes && nodes.every((node, index) => node === cached!.nodes[index]);

  if (isCached) {
    const delta = start! - cached.start;

    return {
      ...cached,
      start: start!,
      end: cached.end + delta,
      replaced: cached.replaced.map((mark) => shiftMark(mark, delta)),
      marks: cached.marks.map((mark) => shiftMark(mark, delta))
    };
  }

  const shown = findShown(doc, blocks, suggestion);

  if (!shown) return null;

  const { base, blocks: suggested } = shown.suggestion;
  const marks = diffBlocks(doc, shown.start, base, suggested, false);
  const result = { ...shown, marks, nodes: getNodesAt(doc, shown.start, base.length)! };

  shownMarksCache.set(suggestion, result);

  return result;
};
/** Null when the suggestion no longer fits. */
const createSuggestionDecorations = (
  doc: ProseMirrorNode,
  blocks: FoundBlocks,
  context: PreviewContext
): PreviewDraw | null => {
  const { thread, options } = context;

  if (thread.suggestion!.title) return createTitleDecorations(doc, context);

  const shown = getShownMarks(doc, blocks, context);

  if (!shown) return null;

  const { start, replaced } = shown;
  // After the cache, as other suggestions' columns change with what's drawn.
  const marks = shown.marks.map((mark) => padTableRow(doc, mark, context.columns));
  const { blocks: suggested } = shown.suggestion;
  const pos = shown.end;
  const $start = doc.resolve(start);
  const needsParent = marks.some((mark) => "node" in mark && options.needsParent(mark.node));

  if (needsParent && $start.depth > 0) {
    const depth = getParentDepth($start, options);
    const from = $start.before(depth);

    return {
      thread,
      suggestion: shown.suggestion,
      from,
      to: from + $start.node(depth).nodeSize,
      decorations: null
    };
  }

  // At the top level, e.g. new steps in suggested steps, the suggested blocks draw whole.
  if (needsParent) {
    const added = suggested.map((node): SuggestionMark => {
      return { type: "block", at: pos, change: "added", node };
    });

    return {
      thread,
      suggestion: shown.suggestion,
      from: start,
      to: pos,
      decorations: createPreviewDecorations([...replaced, ...added], context)
    };
  }

  // Only what it changes, so suggestions on other parts of a block, e.g. a table, draw too.
  const ranges = marks.map((mark): [number, number] => {
    return "from" in mark ? [mark.from, mark.to] : [mark.at, mark.at];
  });

  return {
    thread,
    suggestion: shown.suggestion,
    from: start,
    to: pos,
    decorations: createPreviewDecorations(marks, context),
    ranges
  };
};
const getRanges = ({ from, to, ranges }: PreviewDraw) => ranges ?? [[from, to] as const];
const overlaps = (draw: PreviewDraw, others: PreviewDraw[]) => {
  return getRanges(draw).some(([from, to]) => {
    return others.some((other) => {
      return getRanges(other).some(([start, end]) => {
        // Insertions at the same point overlap too, e.g. two suggestions that add a cell.
        const isSamePoint = from === to && start === end && from === start;

        return (from < end && start < to) || isSamePoint;
      });
    });
  });
};

/** Open suggestions in the content; ones in a redrawn parent join it, else the active one wins. */
const SuggestionPreview = Extension.create<SuggestionPreviewOptions>({
  name: "suggestionPreview",
  addOptions() {
    return { shown: () => false, owner: null, renderBlock: null, needsParent: () => false };
  },
  addDecorations() {
    const { editor, options } = this;

    return {
      create: ({ state }) => {
        const comments = commentsPluginKey.getState(state);

        if (!options.shown() || !comments) return [];

        const commentIDs = new Set(
          comments.threads.filter(({ suggestion }) => !suggestion).map(({ id }) => id)
        );
        const textThreads = comments.threads.filter(({ suggestion, resolved, quote }) => {
          return !suggestion && !resolved && quote;
        });
        const isCommented = (from: number, to: number) => {
          return comments.decorations.find(from, to).some((decoration) => {
            const isInside = decoration.from < to && decoration.to > from;

            return isInside && commentIDs.has(decoration.spec.threadID as string);
          });
        };
        const blocks = getBlocks(state.doc);
        const threads = comments.threads
          .filter(isOpenSuggestion)
          .sort((a, b) => Number(b.id === comments.active) - Number(a.id === comments.active));
        const isActive = (thread: EditorCommentThread) => {
          return [comments.active, comments.hovered].includes(thread.id);
        };
        const draw = (columns: Map<string, number>) => {
          const drawn: PreviewDraw[] = [];
          const shared = { editor, options, isCommented, textThreads, columns };
          const draws = threads.flatMap((thread) => {
            try {
              const context = { ...shared, thread, active: isActive(thread) };

              return createSuggestionDecorations(state.doc, blocks, context) ?? [];
            } catch {
              // A block that doesn't fit the schema; the card still shows it.
              return [];
            }
          });
          // Parents first, so the suggestions in them join them.
          const ordered = [...draws.filter((draw) => !draw.decorations), ...draws];
          const decorations = ordered.flatMap((draw) => {
            if (drawn.includes(draw) || overlaps(draw, drawn)) return [];

            if (draw.decorations) {
              drawn.push(draw);

              return draw.decorations;
            }

            const inside = draws.reduce(
              (result, other) => {
                const isInside = other.from >= draw.from && other.to <= draw.to;
                const canJoin = other !== draw && isInside && !overlaps(other, result.slice(1));

                return canJoin ? [...result, other] : result;
              },
              [draw]
            );

            try {
              const active = inside.some(({ thread }) => isActive(thread));
              const context = { ...shared, thread: draw.thread, active };
              const parent = createParentDecorations(state.doc, inside, context);

              drawn.push(...parent.joined);

              return parent.decorations;
            } catch {
              return [];
            }
          });

          return { drawn, decorations };
        };
        const first = draw(new Map());
        const columns = getTableColumns(first.drawn.flatMap(({ suggestion }) => suggestion.blocks));
        const hasNewColumns = [...columns].some(([id, count]) => {
          const table = blocks.get(id)?.node;

          return table && count > Math.max(0, ...table.children.map((row) => row.childCount));
        });

        // Suggested rows fill the columns other drawn suggestions add, as applying both would.
        return hasNewColumns ? draw(columns).decorations : first.decorations;
      },
      shouldUpdate: ({ tr }) => tr.docChanged || tr.getMeta(commentsPluginKey) !== undefined
    };
  }
});

export { createBlockWidget, SuggestionPreview };
export type { SuggestedBlockProps };
