import { createEffect, createRoot, createSignal, untrack } from "solid-js";
import { formatElement, parseElement, type ElementValue } from "@andesine/document";
import type { Editor, EditorEvents, JSONContent } from "@tiptap/core";
import { Selection } from "@tiptap/pm/state";
import type {
  ChildPresentation,
  ElementPlace,
  ElementViewRenderer,
  ElementViews
} from "../../../client-types";
import {
  elementPresentationKey,
  type PresentationMeta
} from "../../../extensions/element-presentation";
import { EMPTY_PLACE, getElementPlace, getPlaceBase, type PlaceBase } from "./element-place";
import { isSourceShown } from "./source-mode";
import { dragHandleTargetPluginKey } from "#editor/ui/drag-handle/drag-handle-target-plugin";
import { dragTarget } from "#editor/ui/drag-handle/drag-handler";
import { dropTargetPluginKey } from "#editor/extensions/drop-target";
import { getViewTargetAtPoint } from "#editor/ui/element-view-target";
import { MAX_CONTENT_SIZE, toEditorContent } from "#editor/lib/block-action-target";
import { acceptsBlock, getAccepts } from "#editor/lib/element-content";

interface ElementExtensionViewOptions {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  /** The standard content position is before the closing tag. */
  closing: HTMLElement;
  elementViews?: ElementViews;
  /** Called after the representation changes, to update the tag view. */
  onChange(): void;
  editor: Editor;
  getPos(): number | undefined;
  canEdit(): boolean;
  /**
   * Right-clicking the view, not its content, which hides the tags; selects the element, or the
   * descendant whose UI it is, e.g. a tab in a tab bar.
   */
  onContextMenu(descendant: NodeRange | null): void;
}
interface NodeRange {
  pos: number;
  size: number;
}
interface ElementViewState {
  name: string;
  ancestors: string[];
  editing: boolean;
}
interface ElementExtensionView {
  active(): boolean;
  /** The target is in the extension view, outside the editable content. */
  owns(target: Node): boolean;
  /** The target is in the view's own UI, which the caret skips. */
  ownsUI(target: Node): boolean;
  update(state: ElementViewState, props: Record<string, unknown>): void;
  destroy(): void;
}

const MAX_SOURCE_LENGTH = 100_000;

/** A descendant element of the element at the position, by its node ID. */
const findDescendant = (editor: Editor, pos: number | undefined, id: string): NodeRange | null => {
  const node = pos === undefined ? null : editor.state.doc.nodeAt(pos);

  let found: NodeRange | null = null;

  node?.descendants((child, offset) => {
    if (child.attrs.id === id) found = { pos: pos! + 1 + offset, size: child.nodeSize };

    return !found;
  });

  return found;
};
/** Props must round-trip through the element source, so the tag and the props stay consistent. */
const updateElementProps = (
  editor: Editor,
  pos: number | undefined,
  props: Record<string, unknown>
): boolean => {
  const node = typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;

  if (typeof pos !== "number" || node?.type.name !== "element") return false;

  try {
    const data = {
      name: node.attrs.name as string,
      props: props as Record<string, ElementValue>,
      selfClosing: node.attrs.selfClosing as boolean
    };
    const source = formatElement(data);
    const parsed = parseElement(source);
    const roundTrips =
      source.length <= MAX_SOURCE_LENGTH &&
      parsed.name === data.name &&
      JSON.stringify(parsed.props) === JSON.stringify(props);

    if (!roundTrips) return false;

    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: parsed.props, source })
    );

    return true;
  } catch {
    return false;
  }
};
/**
 * Adds a block at the end of the content, e.g. a card or a code block, with the cursor in its
 * text. An element without content gets an empty paragraph, unless it's self-closing. An only empty
 * paragraph makes room for it, and an empty self-closing element, e.g. `<CardGrid />` from MDX,
 * gets content. The element's content rules apply.
 */
const appendChildBlock = (
  editor: Editor,
  pos: number | undefined,
  block: JSONContent,
  elementViews?: ElementViews
): boolean => {
  const node = typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;
  const canHoldChildren =
    node?.type.name === "element" && (!node.attrs.selfClosing || !node.childCount);

  if (typeof pos !== "number" || !node || !canHoldChildren) return false;

  try {
    const { paragraph } = editor.schema.nodes;
    const isEmptyElement =
      block.type === "element" && !block.content?.length && block.attrs?.selfClosing !== true;
    const content = isEmptyElement ? { ...block, content: [{ type: "paragraph" }] } : block;
    const created = editor.schema.nodeFromJSON(toEditorContent(content));
    const rules = elementViews ? getAccepts(editor.state.doc, pos, elementViews) : null;
    const isTooLarge = JSON.stringify(block).length > MAX_CONTENT_SIZE;

    if (isTooLarge || (rules && !acceptsBlock(rules, created))) return false;

    created.check();

    const end = pos + node.nodeSize - 1;
    const isEmpty =
      node.childCount === 1 && node.firstChild?.type === paragraph && !node.firstChild.content.size;
    const from = isEmpty ? pos + 1 : end;
    const tr = editor.state.tr.replaceWith(from, end, created);

    if (node.attrs.selfClosing) {
      const data = { name: node.attrs.name, props: node.attrs.props, selfClosing: false };

      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...data, source: formatElement(data) });
    }

    // Into the new block's text. One without, e.g. a self-closing element, keeps the selection:
    // the text after it can be hidden or far away, e.g. after a file in a file tree.
    const text = Selection.findFrom(tr.doc.resolve(from), 1, true);

    if (text && text.from < from + created.nodeSize) tr.setSelection(text).scrollIntoView();

    editor.view.dispatch(tr);
    editor.view.focus();

    return true;
  } catch {
    return false;
  }
};
/** Only the path to the content stays editable: one editable region, whose caret skips the UI. */
const lockViewUI = (parent: Element, contentDOM: HTMLElement): void => {
  for (const child of parent.children) {
    if (child === contentDOM) continue;

    if (!child.contains(contentDOM)) {
      if (child.getAttribute("contenteditable") !== "false") {
        child.setAttribute("contenteditable", "false");
      }

      continue;
    }

    child.removeAttribute("contenteditable");
    lockViewUI(child, contentDOM);
  }
};
/**
 * The content moves into the view's slot or `parking`, so it stays inside `dom` with the same DOM
 * identity. Tag editing and view failures show the standard tag view.
 */
const createElementExtensionView = (options: ElementExtensionViewOptions): ElementExtensionView => {
  const { contentDOM } = options;
  const container = document.createElement("div");
  const parking = document.createElement("div");
  const [state, setState] = createSignal<ElementViewState>(
    { name: "", ancestors: [], editing: false },
    { equals: (previous, next) => JSON.stringify(previous) === JSON.stringify(next) }
  );
  const [props, setProps] = createSignal<Record<string, unknown>>({});
  const [place, setPlace] = createSignal<ElementPlace>(EMPTY_PLACE, {
    equals: (previous, next) => JSON.stringify(previous) === JSON.stringify(next)
  });
  const updatePlace = () => setPlace(getElementPlace(options.editor, options.getPos()));

  let lastBase: PlaceBase | null = null;

  // Siblings and children change without updating this node, so these transactions recount; other
  // changes, e.g. typing elsewhere, keep the node, its position, its parent, and the selection away.
  const onTransaction = ({ transaction }: EditorEvents["transaction"]) => {
    const isDrag =
      transaction.getMeta(dragHandleTargetPluginKey) || transaction.getMeta(dropTargetPluginKey);

    if (!transaction.docChanged && !transaction.selectionSet && !isDrag) return;

    const base = getPlaceBase(options.editor, options.getPos());
    const previous = lastBase;
    const isKept =
      !isDrag &&
      base &&
      previous &&
      base.pos === previous.pos &&
      base.node === previous.node &&
      base.index === previous.index &&
      base.parentID === previous.parentID &&
      !base.nearSelection &&
      !previous.nearSelection;

    lastBase = base;

    if (!isKept) updatePlace();
  };
  const setChildPresentation = (presentation: ChildPresentation) => {
    const owner = options.editor.state.doc.nodeAt(options.getPos() ?? -1)?.attrs.id;
    const meta: PresentationMeta = { owner, presentation };

    if (!owner) return;

    options.editor.view.dispatch(
      options.editor.state.tr.setMeta(elementPresentationKey, meta).setMeta("addToHistory", false)
    );
  };
  const [fallenBack, setFallenBack] = createSignal(false);
  // The view renders on its own schedule; changes in the content don't move the slot.
  const uiObserver = new MutationObserver((records) => {
    const changesUI = records.some((record) => !contentDOM.contains(record.target));

    if (changesUI) lockViewUI(container, contentDOM);
  });

  let renderer: ElementViewRenderer | null = null;
  let cleanup: (() => void) | null = null;

  const show = (next: ElementViewRenderer | null) => {
    if (next === renderer) return;

    cleanup?.();
    cleanup = null;
    renderer = next;
    // Keeps the content inside the element even if a view did not release it.
    parking.append(contentDOM);
    container.replaceChildren();

    if (next) {
      container.hidden = false;
      cleanup = next.mount({
        container,
        contentDOM,
        parking,
        name: () => state().name,
        place,
        setChildPresentation,
        props,
        fallback: () => setFallenBack(true),
        setProps: (nextProps) => {
          return (
            options.canEdit() && updateElementProps(options.editor, options.getPos(), nextProps)
          );
        },
        append: (block) => {
          return (
            options.canEdit() &&
            appendChildBlock(options.editor, options.getPos(), block, options.elementViews)
          );
        }
      });
    } else {
      options.closing.before(contentDOM);
      container.hidden = true;
    }

    options.onChange();
  };
  const dispose = createRoot((dispose) => {
    createEffect(() => {
      const current = state();
      const showsTag = current.editing || fallenBack() || isSourceShown(place().key);
      const next = showsTag
        ? null
        : (options.elementViews?.resolve(current.name, current.ancestors) ?? null);

      untrack(() => show(next));
    });

    return dispose;
  });

  options.editor.on("transaction", onTransaction);
  container.dataset.elementView = "";
  uiObserver.observe(container, { childList: true, subtree: true });
  // The view's UI takes no caret: the browser would place one there, before the editor moved it.
  container.addEventListener("mousedown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    // Drag areas keep it, or the browser doesn't start a drag; they take the focus instead.
    const keepsDefault = target?.closest("input, textarea, select, [data-block-draggable]");

    if (target && !contentDOM.contains(target) && !keepsDefault) event.preventDefault();
  });
  container.addEventListener("contextmenu", (event) => {
    const target = event.target instanceof Element ? event.target : null;

    if (target && contentDOM.contains(target)) return;

    // The top-level block, or a block that the view opts in, e.g. with a `BlockArea` with `menu`.
    const block = getViewTargetAtPoint(options.editor, event.clientX, event.clientY, false, "menu");

    options.onContextMenu(block ? { pos: block.pos, size: block.node.nodeSize } : null);
  });
  // A `draggable` `BlockArea`'s UI drags its block, e.g. a callout's icon. Only `draggable` elements
  // drag, and the area has no box, so its child that's pressed becomes one.
  const getDragArea = (target: EventTarget | null): HTMLElement | null => {
    const node = target instanceof Node ? target : null;
    // A drag of the browser's selection, e.g. with the element node-selected, starts on text.
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    const trigger = element?.closest("[data-block-area][data-block-draggable]");

    if (!trigger || !container.contains(trigger) || contentDOM.contains(trigger)) return null;

    return (
      Array.from(trigger.children).find((child): child is HTMLElement => {
        return child instanceof HTMLElement && child.contains(element);
      }) ?? null
    );
  };

  container.addEventListener("pointerdown", (event) => {
    const area = getDragArea(event.target);
    const selection = document.getSelection();

    if (!area) return;

    area.draggable = options.canEdit();
    // A press focuses the area, which takes no caret, not the editor.
    area.tabIndex = -1;

    // In the browser's selection, e.g. of the node-selected element, the browser would drag the
    // selected text; in the area, which the editor ignores, it drags the area.
    if (selection?.containsNode(area, true)) selection.collapse(area, 0);
  });
  container.addEventListener("dragstart", (event) => {
    const area = getDragArea(event.target);
    const id = area?.parentElement?.getAttribute("data-block-area");
    const pos = options.getPos();
    const node = typeof pos === "number" ? options.editor.state.doc.nodeAt(pos) : null;

    if (!area || !id || !node) return;

    // An area can stand for the view's own element, e.g. a callout.
    const range =
      node.attrs.id === id
        ? { pos: pos!, size: node.nodeSize }
        : findDescendant(options.editor, pos, id);
    const child = range && options.editor.state.doc.nodeAt(range.pos);
    const blockDOM = range && options.editor.view.nodeDOM(range.pos);
    // UI outside the block's box, e.g. a tab button, is the drag image, as the browser grabs it.
    const nativePreview = !(blockDOM instanceof Node && blockDOM.contains(area));

    if (
      !child ||
      !options.canEdit() ||
      !dragTarget(event, options.editor, { node: child, pos: range.pos, nativePreview })
    ) {
      event.preventDefault();
    }
  });
  container.hidden = parking.hidden = true;
  options.dom.append(container, parking);

  return {
    active: () => renderer !== null,
    owns: (target) => container.contains(target) && !contentDOM.contains(target),
    ownsUI(target) {
      const element = target instanceof Element ? target : target.parentElement;
      const locked = element?.closest('[contenteditable="false"]');

      return Boolean(locked && container.contains(locked) && !contentDOM.contains(target));
    },
    // The place first: a view that mounts on the new state reads it, e.g. its parent.
    update(next, nextProps) {
      updatePlace();
      setProps(nextProps);
      setState(next);
    },
    destroy() {
      options.editor.off("transaction", onTransaction);
      uiObserver.disconnect();
      dispose();
      cleanup?.();
    }
  };
};

export { createElementExtensionView, updateElementProps };
export type { NodeRange };
