import type { CommandProps, Editor, KeyboardShortcutCommand, Range } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { PluginKey, Plugin, Selection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isNodeRangeSelection, NodeRange, NodeRangeSelection } from "@tiptap/extension-node-range";
import { forEachSelectedBlock } from "#editor/ui/block-utils";
import { getViewTargetAtPoint } from "#editor/ui/element-view-target";

interface BlockSelectionRange extends Range {
  depth?: number;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockSelection: {
      setBlockSelection: (position: BlockSelectionRange) => ReturnType;
    };
  }
}

const SCROLL_SHADOW_HEIGHT = 64;
const LIST_TYPES = ["bulletList", "orderedList", "taskList"];
const mapNodeRange = NodeRangeSelection.prototype.map;
const nodeRangePrototype: Pick<Selection, "map"> = NodeRangeSelection.prototype;

// The library throws when no block is left at the mapped place, e.g. after deleting a container's
// last child; the selection becomes a cursor next to it.
nodeRangePrototype.map = function (this: NodeRangeSelection, doc, mapping) {
  try {
    return mapNodeRange.call(this, doc, mapping as Parameters<typeof mapNodeRange>[1]);
  } catch {
    return Selection.near(doc.resolve(mapping.map(this.head)), -1);
  }
};

const BlockSelection = NodeRangeSelection;
const isBlockSelection = isNodeRangeSelection;
const createBlockRangeSelection = (
  doc: ProseMirrorNode,
  position: BlockSelectionRange
): NodeRangeSelection => {
  return new BlockSelection(doc.resolve(position.from), doc.resolve(position.to), position.depth);
};
const isFragmentChildBlockSelection = (selection: Selection): boolean => {
  // By position, as the selection has no `depth` when made with Shift+arrows.
  return isBlockSelection(selection) && selection.$from.depth === 1;
};
const isSameBlockSelection = (selection: Selection, nextSelection: NodeRangeSelection): boolean => {
  return (
    isBlockSelection(selection) &&
    selection.depth === nextSelection.depth &&
    selection.eq(nextSelection)
  );
};
/** The block that a right click at the point selects. */
const getBlockRangeAtCoords = (
  editor: Editor,
  coords: { left: number; top: number }
): BlockSelectionRange | null => {
  const { doc } = editor.state;
  const { pos } = editor.view.posAtCoords(coords) || {};
  // In an element view, the top-level block, or a child that the view opts in.
  const viewBlock = getViewTargetAtPoint(editor, coords.left, coords.top, false, "menu");

  if (viewBlock) {
    const from = viewBlock.pos;

    return { from, to: from + viewBlock.node.nodeSize, depth: doc.resolve(from).depth };
  }

  if (typeof pos !== "number") return null;

  const resolvedPos = doc.resolve(pos);
  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    if (resolvedPos.node(depth).type.name !== "element") continue;

    const childDepth = Math.min(depth + 1, resolvedPos.depth);
    const from = resolvedPos.before(childDepth);

    return { from, to: from + resolvedPos.node(childDepth).nodeSize, depth: childDepth - 1 };
  }
  const pointElement = document.elementFromPoint(coords.left, coords.top);
  const schemaField =
    pointElement
      ?.closest("[data-fragment-header]")
      ?.closest<HTMLElement>("[data-fragment-node-view]") ||
    pointElement?.closest<HTMLElement>("[data-property-node-view]");

  if (schemaField) {
    const $fragment = doc.resolve(editor.view.posAtDOM(schemaField, 0));
    const fragmentFrom = $fragment.depth ? $fragment.before(1) : $fragment.pos;
    const fragment = doc.nodeAt(fragmentFrom);

    if (fragment) return { from: fragmentFrom, to: fragmentFrom + fragment.nodeSize, depth: 0 };
  }

  // In a fragment, its block, as at the top level; the fragment's own controls are on its header.
  if (resolvedPos.depth > 0 && resolvedPos.node(1).type.name === "fragment") {
    const childFrom =
      resolvedPos.depth > 1
        ? resolvedPos.before(2)
        : resolvedPos.nodeAfter
          ? pos
          : pos - (resolvedPos.nodeBefore?.nodeSize ?? 0);
    const child = doc.nodeAt(childFrom);

    if (child) return { from: childFrom, to: childFrom + child.nodeSize, depth: 1 };
  }

  const node = resolvedPos.node(1) || resolvedPos.nodeAfter;
  const from = resolvedPos.start(1);

  return node ? { from, to: from + node.nodeSize - 2 } : null;
};
const setBlockSelectionAtCoords = (
  editor: Editor,
  coords: { left: number; top: number }
): boolean => {
  const { selection } = editor.state;
  const range = getBlockRangeAtCoords(editor, coords);
  // A block selection that covers the range stays, e.g. the selected blocks a menu acts on.
  const isCovered =
    isBlockSelection(selection) &&
    range &&
    selection.from <= range.from &&
    selection.to >= range.to;

  if (range && !isCovered) editor.commands.setBlockSelection(range);

  return Boolean(range);
};
/** The blocks that right clicks at the selection's ends select, or one of them if they aren't siblings. */
const getBlockRangeOfSelection = (editor: Editor): BlockSelectionRange | null => {
  const { doc, selection } = editor.state;
  const start = editor.view.coordsAtPos(selection.from, 1);
  const end = editor.view.coordsAtPos(selection.to, -1);
  const startRange = getBlockRangeAtCoords(editor, {
    left: start.left + 1,
    top: (start.top + start.bottom) / 2
  });
  const endRange = getBlockRangeAtCoords(editor, {
    left: end.left - 1,
    top: (end.top + end.bottom) / 2
  });
  const areSiblings =
    startRange &&
    endRange &&
    startRange.depth === endRange.depth &&
    doc.resolve(startRange.from).node(startRange.depth ?? 0) ===
      doc.resolve(endRange.to).node(endRange.depth ?? 0);

  // An end out of view has no block, e.g. the start of a long selection.
  return areSiblings ? { ...startRange, to: endRange.to } : (startRange ?? endRange);
};
const centerSelectionEnd = ({ view, state }: Editor) => {
  const container = view.dom.closest<HTMLElement>("[data-editor-scrollable-container]");

  if (!container) return;

  const { top, bottom } = container.getBoundingClientRect();
  const end = view.coordsAtPos(state.selection.head, 1).top;
  const isClearOfShadows = end > top + SCROLL_SHADOW_HEIGHT && end < bottom - SCROLL_SHADOW_HEIGHT;

  if (!isClearOfShadows) container.scrollTop += end - (top + bottom) / 2;
};
/** From text in a list, selects the whole list, and the next press leaves it, as for other blocks. */
const selectParentList = (editor: Editor, backward: boolean): boolean => {
  const { doc, selection } = editor.state;

  if (isBlockSelection(selection)) return false;

  for (let depth = 1; depth <= selection.$head.depth; depth += 1) {
    if (!LIST_TYPES.includes(selection.$head.node(depth).type.name)) continue;

    // Just inside the list's edges: the range then is the list, and leaves its items when extended.
    const start = doc.resolve(selection.$head.start(depth));
    const end = doc.resolve(selection.$head.end(depth));

    editor.view.dispatch(
      editor.state.tr.setSelection(
        new BlockSelection(backward ? end : start, backward ? start : end)
      )
    );

    return true;
  }

  return false;
};
/** Keeps the selection's level, and moves up to the parent only at the parent's edge. */
const getExtendedBlockSelection = (
  selection: NodeRangeSelection,
  backward: boolean
): NodeRangeSelection | null => {
  const { $from, $to, ranges } = selection;
  const doc = $from.doc;
  const level = $from.depth;
  const isShrinking =
    ranges.length > 1 && (backward ? selection.isForwards : selection.isBackwards);

  if (isShrinking) {
    const kept = backward ? ranges.slice(0, -1) : ranges.slice(1);
    const $start = kept[0].$from;
    const $end = kept[kept.length - 1].$to;

    return new BlockSelection(backward ? $start : $end, backward ? $end : $start, level);
  }

  const sibling = backward ? $from.nodeBefore : $to.nodeAfter;

  if (sibling) {
    const $edge = doc.resolve(backward ? $from.pos - sibling.nodeSize : $to.pos + sibling.nodeSize);

    return new BlockSelection(backward ? $to : $from, $edge, level);
  }

  if (level === 0) return null;

  const $start = doc.resolve($from.before(level));
  const $end = doc.resolve($from.after(level));

  return new BlockSelection(backward ? $end : $start, backward ? $start : $end, level - 1);
};
const extendSelection = (
  shortcut: KeyboardShortcutCommand,
  backward: boolean
): KeyboardShortcutCommand => {
  return (props) => {
    const { selection, tr } = props.editor.state;

    if (isBlockSelection(selection)) {
      const extended = getExtendedBlockSelection(selection, backward);

      if (extended) props.editor.view.dispatch(tr.setSelection(extended));

      centerSelectionEnd(props.editor);
      return true;
    }

    const handled = selectParentList(props.editor, backward) || shortcut(props);

    if (handled) centerSelectionEnd(props.editor);

    return handled;
  };
};
const BlockSelectionExtension = NodeRange.extend({
  name: "blockSelection",
  priority: 1000,
  addProseMirrorPlugins() {
    const editor = this.editor;
    const parentPlugins = (this as unknown as { parent?: () => Plugin[] }).parent?.() || [];

    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey("blockSelection"),
        props: {
          handleDOMEvents: {
            contextmenu(view, event) {
              if (
                !setBlockSelectionAtCoords(editor, {
                  left: event.clientX,
                  top: event.clientY
                })
              ) {
                return false;
              }

              event.preventDefault();

              return true;
            }
          },
          decorations(state) {
            const { doc, selection } = state;
            const { from, to } = selection;
            const decorations: Decoration[] = [];

            if (!isBlockSelection(selection)) return null;

            forEachSelectedBlock(
              doc,
              from,
              to,
              (node, pos) => {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, { class: "block-selection-marker" })
                );
              },
              { includeCoveredFragments: !isFragmentChildBlockSelection(selection) }
            );

            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  },
  addCommands() {
    return {
      setBlockSelection(position: BlockSelectionRange) {
        return ({ tr }: CommandProps) => {
          const selection = createBlockRangeSelection(tr.doc, position);

          if (isSameBlockSelection(tr.selection, selection)) return true;

          tr.setSelection(selection);

          return true;
        };
      }
    };
  },
  addKeyboardShortcuts() {
    const parentShortcuts =
      (this as unknown as { parent?: () => Record<string, KeyboardShortcutCommand> }).parent?.() ||
      {};

    return {
      ...parentShortcuts,
      "Shift-ArrowUp": extendSelection(parentShortcuts["Shift-ArrowUp"], true),
      "Shift-ArrowDown": extendSelection(parentShortcuts["Shift-ArrowDown"], false),
      "Mod-a": ({ editor }: Parameters<KeyboardShortcutCommand>[0]) => {
        const { state } = editor;
        const { selection, doc } = state;
        const resolvedPos = selection.$from;
        const depth = resolvedPos.depth > 0 ? 1 : 0;
        const currentNode = resolvedPos.node(depth);
        const titleNode = doc.firstChild;

        if (!titleNode) return false;

        const titleRange = {
          from: 1,
          to: titleNode.nodeSize - 1
        };
        const contentRange = {
          from: titleNode.nodeSize + 1,
          to: doc.content.size - 1
        };
        const documentRange = {
          from: titleRange.from,
          to: contentRange.to
        };
        const coversRange = (range: Range) => {
          return selection.from <= range.from && selection.to >= range.to;
        };

        // Title: title block -> entire document.
        if (currentNode?.type.name === "title") {
          const range =
            isBlockSelection(selection) && coversRange(titleRange) ? documentRange : titleRange;

          if (isBlockSelection(selection) && coversRange(range)) return true;

          return editor.chain().setBlockSelection(range).run();
        }

        // Content: current block -> all content without the title -> entire document.
        if (isBlockSelection(selection)) {
          const range = coversRange(contentRange) ? documentRange : contentRange;

          if (coversRange(range)) return true;

          return editor.chain().setBlockSelection(range).run();
        }

        // First press: block-select current node
        if (!currentNode) return false;

        const from = resolvedPos.start(depth);
        const to = from + currentNode.nodeSize - 2;

        return editor.chain().setBlockSelection({ from, to }).run();
      }
    };
  }
});

export {
  BlockSelectionExtension as BlockSelection,
  createBlockRangeSelection,
  isBlockSelection,
  isFragmentChildBlockSelection,
  isSameBlockSelection,
  getBlockRangeOfSelection,
  setBlockSelectionAtCoords
};
