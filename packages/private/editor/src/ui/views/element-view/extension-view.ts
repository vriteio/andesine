import { createEffect, createRoot, createSignal, untrack } from "solid-js";
import { formatElement, parseElement, type ElementValue } from "@andesine/document";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { ElementViewRenderer, ElementViews } from "../../../client-types";

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
  update(state: ElementViewState, props: Record<string, unknown>): void;
  destroy(): void;
}

const MAX_SOURCE_LENGTH = 100_000;

/** The names of the elements that enclose the position, nearest first. */
const getElementAncestors = (doc: ProseMirrorNode, pos: number | undefined): string[] => {
  const names: string[] = [];

  if (typeof pos !== "number") return names;

  try {
    const $pos = doc.resolve(pos);

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const ancestor = $pos.node(depth);

      if (ancestor.type.name === "element") names.push(ancestor.attrs.name);
    }
  } catch {
    /* The node can be outside the current document while it is replaced. */
  }

  return names;
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
  const [fallenBack, setFallenBack] = createSignal(false);

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
      contentDOM.contentEditable = "true";
      container.hidden = false;
      cleanup = next.mount({
        container,
        contentDOM,
        parking,
        name: () => state().name,
        props,
        fallback: () => setFallenBack(true),
        setProps: (nextProps) => {
          return (
            options.canEdit() && updateElementProps(options.editor, options.getPos(), nextProps)
          );
        }
      });
    } else {
      options.closing.before(contentDOM);
      contentDOM.removeAttribute("contenteditable");
      container.hidden = true;
    }

    options.onChange();
  };
  const dispose = createRoot((dispose) => {
    createEffect(() => {
      const current = state();
      const next =
        current.editing || fallenBack()
          ? null
          : (options.elementViews?.resolve(current.name, current.ancestors) ?? null);

      untrack(() => show(next));
    });

    return dispose;
  });

  container.dataset.elementView = "";
  container.contentEditable = "false";
  container.hidden = parking.hidden = true;
  options.dom.append(container, parking);

  return {
    active: () => renderer !== null,
    owns: (target) => container.contains(target) && !contentDOM.contains(target),
    update(next, nextProps) {
      setState(next);
      setProps(nextProps);
    },
    destroy() {
      dispose();
      cleanup?.();
    }
  };
};

export { createElementExtensionView, getElementAncestors, updateElementProps };
