import { Extension, type EditorEvents } from "@tiptap/core";
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state";
import type { ResolvedPos, Slice } from "@tiptap/pm/model";
import { dropPoint } from "@tiptap/pm/transform";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import {
  type ElementContent,
  canonicalElementValue,
  ELEMENT_BLOCKS,
  findDisallowedElementBlock,
  getElementData,
  normalizeElementAttributes
} from "../lib/element";

interface ElementsOptions {
  notify?(type: "success" | "error", text: string): void;
}

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
    if (node.type.name === "element" && node.attrs.selfClosing) {
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

const Elements = Extension.create<ElementsOptions>({
  name: "elements",
  priority: 110,
  addOptions() {
    return {};
  },
  addProseMirrorPlugins() {
    const { editor, options } = this;

    return [
      new Plugin({
        props: {
          handleKeyDown(view, event) {
            const { selection, doc } = view.state;
            const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
            const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
            const direction = horizontal ? (forward ? "right" : "left") : forward ? "down" : "up";

            if (
              !view.editable ||
              event.isComposing ||
              event.defaultPrevented ||
              event.shiftKey ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              (!forward && event.key !== "ArrowUp" && event.key !== "ArrowLeft")
            ) {
              return false;
            }
            if (selection instanceof NodeSelection && selection.node.type.name === "element") {
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
              return editor.commands.editElement(
                forward ? $position.pos : $position.pos - adjacent.nodeSize,
                false,
                forward ? "start" : "end"
              );
            }
            if (!forward && !adjacent && $position.parent.type.name === "element") {
              return editor.commands.editElement($position.before(), false, "end");
            }
            return false;
          },
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
          if (!transaction.docChanged || transaction.getMeta(ySyncPluginKey)) {
            return true;
          }
          let valid = true;

          transaction.doc.descendants((node) => {
            if (node.type.name !== "element") {
              return;
            }
            try {
              const data = getElementData(node.attrs);
              if (data.selfClosing && node.childCount) {
                valid = false;
              }
            } catch {
              valid = false;
            }
          });
          return valid;
        },
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }
          const tr = state.tr;

          state.doc.descendants((node, position) => {
            if (node.type.name !== "element") {
              return;
            }
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
          return tr.docChanged ? tr : null;
        },
        view() {
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
          return {
            destroy() {
              editor.off("transaction", activate);
            }
          };
        }
      })
    ];
  }
});

export { Elements };
