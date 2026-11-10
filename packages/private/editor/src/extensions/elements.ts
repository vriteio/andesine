import {
  type ElementContent,
  canonicalElementValue,
  ELEMENT_BLOCKS,
  findDisallowedElementBlock,
  getElementData,
  normalizeElementAttributes
} from "@andesine/document";
import { Extension, type EditorEvents } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { NodeSelection, Plugin, Selection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Slice, type ResolvedPos } from "@tiptap/pm/model";
import { dropPoint } from "@tiptap/pm/transform";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { createElementPresentationPlugin } from "./element-presentation";
import { createDropTargetPlugin, dropTargetPluginKey, EMPTY_DROP_TARGET } from "./drop-target";
import { getDropSlot } from "#editor/ui/element-view-drop";
import {
  activateSelectedBlock,
  findNextStop,
  getSelectedBlock,
  isShown,
  leaveBlock,
  selectStop
} from "#editor/ui/keyboard-stops";
import type { ElementViews } from "#editor/client-types";
import { acceptsBlock, addsRejectedChildren, getAccepts } from "#editor/lib/element-content";

interface ElementsOptions {
  notify?(type: "success" | "error", text: string): void;
  /** Their content rules limit what elements' content takes. */
  elementViews?: ElementViews;
}

/** Whether the editor's own drag drops at the point, by the element rules that a drop checks. */
const canDrop = (
  view: EditorView,
  coords: { left: number; top: number },
  elementViews?: ElementViews
): boolean => {
  const { dragging, state } = view;
  const position = view.posAtCoords(coords);

  if (!dragging?.slice || !position) return true;

  const target = dropPoint(state.doc, position.pos, dragging.slice) ?? position.pos;
  const tr = state.tr;
  const { from, to } = state.selection;
  // Moved blocks don't drop into themselves, e.g. a callout into its own content.
  const isInsideMoved = dragging.move && target > from && target < to;

  if (isInsideMoved) return false;
  if (getInvalidElementInsertion(state.doc.resolve(target), dragging.slice)) return false;
  if (!elementViews) return true;

  try {
    if (dragging.move) tr.deleteSelection();

    tr.replaceRange(tr.mapping.map(target), tr.mapping.map(target), dragging.slice);
  } catch {
    return false;
  }

  return !addsRejectedChildren(tr, elementViews, true);
};
/**
 * A copy within one element's content is that content, not the element around it: the element is
 * defining, so a paste would add a new one, e.g. a callout in a callout.
 */
const unwrapOpenElements = (slice: Slice): Slice => {
  let current = slice;

  while (
    current.openStart > 0 &&
    current.openEnd > 0 &&
    current.content.childCount === 1 &&
    current.content.firstChild!.type.name === "element"
  ) {
    current = new Slice(
      current.content.firstChild!.content,
      current.openStart - 1,
      current.openEnd - 1
    );
  }

  return current;
};
const getInvalidElementInsertion = ($position: ResolvedPos, slice: Slice): string | null => {
  const elements: ElementContent[] = [];
  const parentDepth = Math.max(
    0,
    $position.parent.isTextblock ? $position.depth - 1 : $position.depth
  );
  const parent = $position.node(parentDepth);
  const index = $position.index(parentDepth);
  const endIndex = index + ($position.parent.isTextblock ? 1 : 0);

  let allowed: readonly string[] = ELEMENT_BLOCKS;
  let invalidFragment: string | null = null;

  slice.content.descendants((node, position) => {
    const complete =
      position >= slice.openStart && position + node.nodeSize <= slice.content.size - slice.openEnd;
    const preservesFragment =
      complete &&
      node.type.name === "fragment" &&
      parent.canReplaceWith(index, endIndex, node.type);

    if (preservesFragment) {
      invalidFragment ||= findDisallowedElementBlock(
        node.content.toJSON() || [],
        node.attrs.allowedBlocks || ELEMENT_BLOCKS
      );
      return false;
    }

    if (node.type.name === "element" && complete) {
      elements.push(node.toJSON());
      return false;
    }
  });

  if (invalidFragment) return invalidFragment;

  if (!elements.length) {
    return null;
  }

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth);
    if (
      node.type.name === "tableCell" ||
      node.type.name === "tableHeader" ||
      node.type.name === "title" ||
      node.type.name === "property"
    ) {
      return "element";
    }
    if (node.type.name === "fragment") {
      allowed = node.attrs.allowedBlocks || ELEMENT_BLOCKS;
      break;
    }
  }

  if (parent === $position.doc) {
    let schemaControlled = false;
    parent.forEach((node) => {
      if (["fragment", "property"].includes(node.type.name) && node.attrs.schemaFieldID) {
        schemaControlled = true;
      }
    });
    if (schemaControlled) {
      return "element";
    }
  }
  if (!parent.canReplaceWith(index, endIndex, parent.type.schema.nodes.element)) {
    return "element";
  }
  return findDisallowedElementBlock(elements, allowed);
};

/** Whether the element at the position shows an extension view, not its tag. */
const showsView = (view: EditorView, pos: number): boolean => {
  const dom = view.nodeDOM(pos);

  return (
    dom instanceof HTMLElement &&
    Boolean(dom.querySelector(":scope > [data-element-view]:not([hidden])"))
  );
};
/** The nearest text in the direction that's shown, not e.g. in an empty folder's hidden content. */
const findShownText = (view: EditorView, $from: ResolvedPos, dir: number): Selection | null => {
  const isShownText = (found: Selection) => isShown(view.nodeDOM(found.$from.before()));

  let found = Selection.findFrom($from, dir, true);

  while (found && !isShownText(found)) {
    const $next = $from.doc.resolve(dir > 0 ? found.$from.after() : found.$from.before());

    found = Selection.findFrom($next, dir, true);
  }

  return found;
};
const Elements = Extension.create<ElementsOptions>({
  name: "elements",
  priority: 110,
  addOptions() {
    return {};
  },
  addProseMirrorPlugins() {
    const { editor, options } = this;

    return [
      createElementPresentationPlugin(),
      createDropTargetPlugin(),
      new Plugin({
        // A view lays out its content, e.g. as a grid; a gap cursor in it moves to the next shown text.
        appendTransaction(_transactions, oldState, newState) {
          const { selection } = newState;
          const { $head } = selection;
          const isInView =
            selection instanceof GapCursor &&
            $head.depth > 0 &&
            $head.parent.type.name === "element" &&
            showsView(editor.view, $head.before());

          if (!isInView) return null;

          const dir = selection.head >= oldState.selection.head ? 1 : -1;
          const text =
            findShownText(editor.view, $head, dir) ?? findShownText(editor.view, $head, -dir);

          return text ? newState.tr.setSelection(text).scrollIntoView() : null;
        }
      }),
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            const { selection, doc } = view.state;
            const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
            const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
            const direction = horizontal ? (forward ? "right" : "left") : forward ? "down" : "up";
            const dir = forward ? 1 : -1;
            const selected = getSelectedBlock(editor);
            const hasModifier = event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;

            if (!view.editable || event.isComposing || event.defaultPrevented || hasModifier) {
              return false;
            }

            // On a selected block stop, e.g. a tab reached with the arrow keys: Enter or Space.
            if (activateSelectedBlock(editor, event.key)) return true;

            if (selected && event.key === "Escape") return leaveBlock(editor, selected.pos);

            if (!forward && event.key !== "ArrowUp" && event.key !== "ArrowLeft") return false;

            // The arrow keys stop on blocks without text too, e.g. file rows, as block selections.
            if (selected) {
              const stop = findNextStop(editor, { ...selected, block: true }, dir);

              if (stop) selectStop(editor, stop, dir);

              return true;
            }

            const isAtTextEdge =
              selection instanceof TextSelection &&
              selection.empty &&
              selection.$head.depth > 0 &&
              view.endOfTextblock(direction);
            const next = isAtTextEdge
              ? findNextStop(editor, { pos: selection.$head.before(), block: false }, dir)
              : null;

            if (next?.kind === "block") return selectStop(editor, next, dir);

            // Elements with a view keep it; the native caret moves through their content.
            if (selection instanceof NodeSelection && selection.node.type.name === "element") {
              if (showsView(view, selection.from)) return false;

              return editor.commands.editElement(selection.from, false, forward ? "start" : "end");
            }
            if (!selection.empty) return false;

            let $position = selection.$head;

            if (selection instanceof TextSelection) {
              if (!$position.depth || !view.endOfTextblock(direction)) return false;

              $position = doc.resolve(forward ? $position.after() : $position.before());
            }

            const adjacent = forward ? $position.nodeAfter : $position.nodeBefore;

            if (adjacent?.type.name === "element") {
              const pos = forward ? $position.pos : $position.pos - adjacent.nodeSize;

              if (showsView(view, pos)) return false;

              return editor.commands.editElement(pos, false, forward ? "start" : "end");
            }

            const leavesElement = !forward && !adjacent && $position.parent.type.name === "element";

            if (leavesElement && !showsView(view, $position.before())) {
              return editor.commands.editElement($position.before(), false, "end");
            }
            return false;
          },
          transformCopied: unwrapOpenElements,
          transformPasted: unwrapOpenElements,
          handlePaste(view, _event, slice) {
            const invalid = getInvalidElementInsertion(view.state.selection.$from, slice);

            if (!invalid) {
              return false;
            }
            options.notify?.(
              "error",
              `Cannot paste: this location does not allow ${invalid} blocks.`
            );
            return true;
          },
          handleDrop(view, event, slice) {
            const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
            const target =
              position && (dropPoint(view.state.doc, position.pos, slice) ?? position.pos);
            const invalid =
              target !== null && getInvalidElementInsertion(view.state.doc.resolve(target), slice);

            if (!invalid) {
              return false;
            }
            options.notify?.(
              "error",
              `Cannot move: this location does not allow ${invalid} blocks.`
            );
            return true;
          }
        },
        filterTransaction(transaction) {
          const { elementViews } = options;

          if (!transaction.docChanged || transaction.getMeta(ySyncPluginKey)) {
            return true;
          }
          // A drop into a self-closing element opens it; `appendTransaction` updates its attrs.
          const opensSelfClosing = transaction.getMeta("uiEvent") === "drop";
          let valid = true;

          transaction.doc.descendants((node) => {
            if (node.type.name !== "element") {
              return;
            }
            try {
              const data = getElementData(node.attrs);
              if (data.selfClosing && node.childCount && !opensSelfClosing) {
                valid = false;
              }
            } catch {
              valid = false;
            }
          });

          if (!valid || !elementViews) return valid;

          // Elements with content rules take only blocks they accept; content already there stays.
          const addsRejected = addsRejectedChildren(transaction, elementViews, true);
          const action = { paste: "paste", drop: "move" }[transaction.getMeta("uiEvent") as string];

          if (addsRejected && action) {
            options.notify?.(
              "error",
              `Cannot ${action}: the element here doesn't accept these blocks.`
            );
          }

          return !addsRejected;
        },
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }
          const { elementViews } = options;
          const tr = state.tr;
          const isDrop = transactions.some(
            (transaction) => transaction.getMeta("uiEvent") === "drop"
          );
          const placeholders: number[] = [];

          state.doc.descendants((node, position) => {
            if (node.type.name !== "element") {
              return;
            }
            // A drop into an element that takes no paragraphs replaces its empty placeholder one.
            const rules =
              isDrop && elementViews && node.childCount > 1
                ? getAccepts(state.doc, position, elementViews)
                : null;

            node.forEach((child, offset) => {
              const isPlaceholder = rules && child.type.name === "paragraph" && !child.content.size;

              if (isPlaceholder && !acceptsBlock(rules, child)) {
                placeholders.push(position + 1 + offset);
              }
            });
            try {
              const attrs = normalizeElementAttributes(
                node.attrs.selfClosing && node.childCount
                  ? { ...node.attrs, selfClosing: false }
                  : node.attrs
              );
              if (canonicalElementValue(attrs) !== canonicalElementValue(node.attrs)) {
                tr.setNodeMarkup(position, undefined, attrs);
              }
            } catch {
              /* Server validation rejects invalid remote attributes. */
            }
          });
          placeholders.reverse().forEach((position) => tr.delete(position, position + 2));
          return tr.docChanged ? tr : null;
        },
        view(view) {
          // Over a place that doesn't take the dragged blocks, no drop cursor and no drop.
          // Among droppable areas, the views mark the target, e.g. the card whose place it takes.
          const onDragOver = (event: DragEvent) => {
            const coords = { left: event.clientX, top: event.clientY };
            const slot = view.dragging ? getDropSlot(editor, coords) : undefined;
            const allowed =
              !view.dragging || (slot !== null && canDrop(view, coords, options.elementViews));
            const effect = view.dragging?.move ? "move" : "copy";
            const target = slot && allowed ? slot.target : null;

            if (event.dataTransfer && view.dragging) {
              event.dataTransfer.dropEffect = allowed ? effect : "none";
            }

            if (dropTargetPluginKey.getState(view.state)?.target !== target) {
              view.dispatch(view.state.tr.setMeta(dropTargetPluginKey, { target }));
            }

            // After the drop cursor plugin, which can create the cursor in this event.
            requestAnimationFrame(() => {
              const cursor =
                view.dom.offsetParent?.querySelector<HTMLElement>(":scope > .drop-cursor");

              if (cursor) cursor.style.visibility = allowed && slot === undefined ? "" : "hidden";
            });
          };
          const onDragEnd = (event: DragEvent) => {
            const current = dropTargetPluginKey.getState(view.state);

            // The editor clears its drag only for drags from its content; a drag from the drag
            // handle or a view's UI that isn't dropped would keep it, and with it drop positions.
            if (event.type === "dragend") view.dragging = null;

            if (!current?.dragged && current?.target === null) return;

            view.dispatch(view.state.tr.setMeta(dropTargetPluginKey, EMPTY_DROP_TARGET));
          };
          const activate = ({ transaction }: EditorEvents["transaction"]) => {
            const target = transaction.getMeta("elementEdit");

            if (!target) {
              return;
            }
            queueMicrotask(() => {
              if (editor.isDestroyed || editor.state.selection.from !== target.position) return;

              const dom = editor.view.nodeDOM(target.position);

              if (dom instanceof HTMLElement) {
                dom.dispatchEvent(new CustomEvent("element-edit", { detail: target }));
              }
            });
          };

          editor.on("transaction", activate);
          view.dom.addEventListener("dragover", onDragOver);
          document.addEventListener("drop", onDragEnd);
          document.addEventListener("dragend", onDragEnd);
          return {
            destroy() {
              editor.off("transaction", activate);
              view.dom.removeEventListener("dragover", onDragOver);
              document.removeEventListener("drop", onDragEnd);
              document.removeEventListener("dragend", onDragEnd);
            }
          };
        }
      })
    ];
  }
});

export { showsView, Elements };
