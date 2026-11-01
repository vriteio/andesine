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
const setBlockSelectionAtCoords = (
  editor: Editor,
  coords: { left: number; top: number }
): boolean => {
  const { doc, selection } = editor.state;
  const { pos } = editor.view.posAtCoords(coords) || {};
  // In an element view, the top-level block, or a child that the view opts in.
  const viewBlock = getViewTargetAtPoint(editor, coords.left, coords.top, false, "menu");

  if (viewBlock) {
    const to = viewBlock.pos + viewBlock.node.nodeSize;

    if (!(isBlockSelection(selection) && selection.from <= viewBlock.pos && selection.to >= to)) {
      editor.commands.setBlockSelection({
        from: viewBlock.pos,
        to,
        depth: doc.resolve(viewBlock.pos).depth
      });
    }

    return true;
  }

  if (typeof pos !== "number") return false;

  const resolvedPos = doc.resolve(pos);
  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    if (resolvedPos.node(depth).type.name !== "element") continue;

    const childDepth = Math.min(depth + 1, resolvedPos.depth);
    const child = resolvedPos.node(childDepth);
    const from = resolvedPos.before(childDepth);
    const to = from + child.nodeSize;

    if (!(isBlockSelection(selection) && selection.from <= from && selection.to >= to)) {
      editor.commands.setBlockSelection({ from, to, depth: childDepth - 1 });
    }
    return true;
  }
  const headerFragment = document
    .elementFromPoint(coords.left, coords.top)
    ?.closest("[data-fragment-header]")
    ?.closest<HTMLElement>("[data-fragment-node-view]");

  if (headerFragment) {
    const $fragment = doc.resolve(editor.view.posAtDOM(headerFragment, 0));
    const fragmentFrom = $fragment.depth ? $fragment.before(1) : $fragment.pos;
    const fragment = doc.nodeAt(fragmentFrom);

    if (fragment) {
      editor.commands.setBlockSelection({
        from: fragmentFrom,
        to: fragmentFrom + fragment.nodeSize,
        depth: 0
      });

      return true;
    }
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

    if (child) {
      const childTo = childFrom + child.nodeSize;

      if (!(
        isBlockSelection(selection) &&
        selection.from <= childFrom &&
        selection.to >= childTo
      )) {
        editor.commands.setBlockSelection({ from: childFrom, to: childTo, depth: 1 });
      }

      return true;
    }
  }

  const node = resolvedPos.node(1) || resolvedPos.nodeAfter;

  if (!node) return false;

  const from = resolvedPos.start(1);
  const to = from + node.nodeSize - 2;

  if (!(isBlockSelection(selection) && selection.from <= from && selection.to >= to)) {
    editor.chain().setBlockSelection({ from, to }).run();
  }

  return true;
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
  setBlockSelectionAtCoords
};
