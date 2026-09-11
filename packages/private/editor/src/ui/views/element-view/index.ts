import { isPositionInInheritedField } from "../../block-utils";
import { untrack } from "solid-js";
import type { EditorView as CodeEditorView } from "@codemirror/view";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { NodeViewRenderer, EditorEvents } from "@tiptap/core";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import { setElementExitSelection } from "../../../lib/element-selection";
import { createElementAwareness } from "../../../lib/element-awareness";
import { renderElementTag } from "./tag-presence";
import { createElementDiffView } from "../../../extensions/version-diff/element";
import { closeHistory } from "@tiptap/pm/history";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import {
  normalizeElementAttributes,
  getElementTagName,
  parseElement,
  tokenizeElement,
  type ElementData
} from "../../../lib/element";

interface ElementViewOptions {
  owner: unknown;
  awareness: HocuspocusProvider["awareness"];
  user(): { name: string; color: string };
  editable(): boolean;
  schema: boolean;
}

const createElementViewRenderer =
  (options: ElementViewOptions): NodeViewRenderer =>
  (props) => {
    const { editor, getPos } = props;
    const dom = document.createElement("div");
    const opening = document.createElement("div");
    const contentDOM = document.createElement("div");
    const closing = document.createElement("div");
    const awareness = options.awareness;
    let node = props.node;
    let code: CodeEditorView | null = null;
    let editing = false;
    let destroyed = false;
    let generation = 0;
    let draftSource = "";
    let draftName = "";
    let renderedSource: string | null = null;
    let formatting: ((view: CodeEditorView) => boolean) | null = null;

    dom.dataset.elementNodeView = "";
    dom.dataset.type = "element";
    dom.className = "element-node";
    opening.dataset.elementTag = "opening";
    closing.dataset.elementTag = "closing";
    opening.className = closing.className = "element-tag";
    opening.contentEditable = closing.contentEditable = "false";
    contentDOM.dataset.elementContent = "";
    contentDOM.className = "element-content";
    dom.append(opening, contentDOM, closing);

    const diff = createElementDiffView(dom, opening, closing, options.owner);
    const presence = createElementAwareness(awareness, () => node.attrs.id, options.user);
    const canEdit = () => {
      const pos = getPos();
      return (
        // Node views can render inside the memo that creates the editor.
        untrack(options.editable) &&
        editor.isEditable &&
        typeof pos === "number" &&
        (!options.schema || !isPositionInInheritedField(editor.state.doc, pos))
      );
    };
    const render = () => {
      const remote = presence.getRemote();

      if (!editing) {
        const source = remote?.source ?? String(normalizeElementAttributes(node.attrs).source);
        const renderKey = JSON.stringify([source, remote]);

        if (renderKey !== renderedSource) {
          opening.replaceChildren(...renderElementTag(source, remote));
          renderedSource = renderKey;
        }
      } else {
        renderedSource = null;
      }
      closing.replaceChildren();
      if (!node.attrs.selfClosing) {
        const name =
          remote?.source === undefined ? node.attrs.name : getElementTagName(remote.source);
        const text = `</${editing ? draftName : name}>`;

        if (editing) {
          for (const token of tokenizeElement(text)) {
            const span = document.createElement("span");

            span.className = `element-token-${token.kind}`;
            span.textContent = text.slice(token.from, token.to);
            closing.append(span);
          }
        } else {
          closing.textContent = text;
        }
      }
      contentDOM.hidden = closing.hidden = node.attrs.selfClosing;
      dom.toggleAttribute("data-element-editing", editing);
      dom.toggleAttribute("data-element-locked", !!remote);
      opening.title = closing.title = remote ? `${remote.name} is editing this tag.` : "";
      opening.tabIndex = !editing && canEdit() && !remote ? 0 : -1;
      if (editing) {
        opening.removeAttribute("role");
        opening.removeAttribute("aria-label");
        opening.removeAttribute("aria-disabled");
      } else {
        opening.setAttribute("role", "button");
        opening.setAttribute(
          "aria-label",
          remote ? opening.title : `Edit ${node.attrs.name} opening tag`
        );
        opening.setAttribute("aria-disabled", String(!canEdit() || Boolean(remote)));
      }
    };
    const finish = (
      action: "enter" | "down" | "up" | "cancel" | "blur",
      selectionMoved = false
    ) => {
      if (!editing || destroyed) {
        return;
      }
      if (
        action === "blur" &&
        !selectionMoved &&
        (code?.hasFocus ||
          document.activeElement?.closest("[data-block-action-menu], [data-block-menu-trigger]"))
      ) {
        return;
      }

      const draft = code?.state.doc.toString();
      const source = draft === draftSource.replace(/\r\n?/g, "\n") ? draftSource : draft;
      const pos = getPos();
      let data: ElementData | null = null;

      if (action !== "cancel" && source !== undefined && source !== draftSource) {
        try {
          data = parseElement(source);
        } catch {
          /* Invalid drafts are discarded. */
        }
      }
      editing = false;
      generation += 1;
      code?.destroy();
      code = null;
      if (typeof pos !== "number" || editor.isDestroyed) {
        presence.release();
        return;
      }

      const current = editor.state.doc.nodeAt(pos);
      const tr = closeHistory(editor.state.tr);
      const empty =
        current &&
        (!current.childCount ||
          (current.childCount === 1 &&
            current.firstChild?.type.name === "paragraph" &&
            !current.firstChild.content.size));

      if (current?.type.name !== "element" || current.attrs.id !== node.attrs.id) {
        presence.release();
        render();
        return;
      }
      if (data && (!data.selfClosing || empty)) {
        const attrs = { ...current.attrs, ...data, source };
        const content = data.selfClosing
          ? undefined
          : current.content.size
            ? current.content
            : editor.schema.nodes.paragraph.create();

        if (data.selfClosing !== current.attrs.selfClosing) {
          tr.replaceWith(pos, pos + current.nodeSize, current.type.create(attrs, content));
        } else if (source !== current.attrs.source) {
          tr.setNodeMarkup(pos, undefined, attrs);
        }
      }

      const updated = tr.doc.nodeAt(pos)!;
      const converted = current.attrs.selfClosing && !updated.attrs.selfClosing;

      if (action !== "blur" || converted) {
        setElementExitSelection(tr, pos, action === "blur" ? "enter" : action);
      }

      yUndoPluginKey.getState(editor.state)?.undoManager?.stopCapturing();
      try {
        editor.view.dispatch(action === "blur" ? tr : tr.scrollIntoView());
      } finally {
        presence.release();
      }
      yUndoPluginKey.getState(editor.state)?.undoManager?.stopCapturing();
      render();
      if (action !== "blur" || converted) {
        editor.view.focus();
      }
    };
    const start = async (
      selectName = false,
      pointer?: { x: number; y: number },
      edge?: "start" | "end"
    ) => {
      const pos = getPos();

      if (destroyed || !canEdit() || presence.getRemote() || typeof pos !== "number") {
        return;
      }
      if (editing) {
        code?.focus();
        return;
      }

      editor.view.dispatch(
        editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos))
      );
      editing = true;
      draftName = node.attrs.name;
      const attempt = ++generation;

      presence.publish(String(normalizeElementAttributes(node.attrs).source));
      render();
      try {
        const module = await import("./code-editor");

        if (destroyed || !editing || generation !== attempt) {
          return;
        }
        opening.replaceChildren();
        formatting = module.formatTagDraft;
        draftSource = String(normalizeElementAttributes(node.attrs).source);
        code = module.createElementCodeEditor({
          parent: opening,
          source: draftSource,
          selectName,
          edge,
          onChange(source, selection) {
            draftName = getElementTagName(source);
            presence.publish(source, { anchor: selection.anchor, head: selection.head });
            render();
          },
          finish
        });
        if (pointer) {
          const position = code.posAtCoords(pointer);
          if (position !== null) {
            code.dispatch({ selection: { anchor: position } });
          }
        }
      } catch {
        finish("cancel");
      }
    };
    const click = (event: MouseEvent) => {
      if (editing && opening.contains(event.target as globalThis.Node)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void start(
        false,
        opening.contains(event.target as globalThis.Node)
          ? { x: event.clientX, y: event.clientY }
          : undefined
      );
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        !editing ||
        !(target instanceof HTMLElement) ||
        opening.contains(target) ||
        closing.contains(target)
      ) {
        return;
      }
      if (target.closest("[data-block-action-menu], [data-block-menu-trigger]")) {
        return;
      }
      queueMicrotask(() => finish("blur", true));
    };
    const onEditableChange = () => {
      if (editing && !canEdit()) {
        finish("cancel");
      }
      render();
    };
    const onTransaction = ({ transaction }: EditorEvents["transaction"]) => {
      if (editing && transaction.selectionSet) {
        const pos = getPos();
        if (
          editor.state.selection.from !== pos ||
          editor.state.selection.to !== pos + node.nodeSize
        ) {
          queueMicrotask(() => finish("blur", true));
        }
      }
      render();
    };

    contentDOM.addEventListener("mousedown", (event) => {
      const pos = getPos();
      if (!canEdit() || node.childCount || node.attrs.selfClosing || typeof pos !== "number") {
        return;
      }
      event.preventDefault();
      const tr = editor.state.tr.insert(pos + 1, editor.schema.nodes.paragraph.create());
      tr.setSelection(Selection.near(tr.doc.resolve(pos + 1)));
      editor.view.dispatch(tr);
      editor.view.focus();
    });
    const contextMenu = () => {
      const pos = getPos();
      if (editing || !canEdit() || typeof pos !== "number") {
        return;
      }
      editor.commands.setBlockSelection({
        from: pos,
        to: pos + node.nodeSize,
        depth: editor.state.doc.resolve(pos).depth
      });
    };
    opening.addEventListener("contextmenu", contextMenu);
    closing.addEventListener("contextmenu", contextMenu);
    opening.addEventListener("click", click);
    closing.addEventListener("click", click);
    opening.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.target !== opening) {
        return;
      }
      if (!editing && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        void start();
      }
    });
    dom.addEventListener("element-edit", (event) => {
      const detail = (event as CustomEvent).detail;

      void start(detail?.selectName, undefined, detail?.edge);
    });
    dom.addEventListener("element-commit", () => finish("blur", true));
    dom.addEventListener("element-format", () => {
      if (code) {
        formatting?.(code);
        queueMicrotask(() => code?.focus());
      }
    });
    document.addEventListener("pointerdown", onPointerDown, true);
    awareness?.on("change", render);
    editor.on("transaction", onTransaction);
    editor.on("update", onEditableChange);
    render();
    diff.update(props.decorations);

    return {
      dom,
      contentDOM,
      update(next, decorations) {
        if (next.type !== node.type || next.attrs.id !== node.attrs.id) {
          return false;
        }
        node = next;
        render();
        diff.update(decorations);
        return true;
      },
      stopEvent(event) {
        return (
          opening.contains(event.target as globalThis.Node) ||
          closing.contains(event.target as globalThis.Node)
        );
      },
      ignoreMutation(mutation) {
        if (mutation.type === "selection") {
          return editing && !contentDOM.contains(mutation.target);
        }
        if (mutation.type === "attributes" && mutation.target === contentDOM) {
          return true;
        }
        return mutation.target !== contentDOM && !contentDOM.contains(mutation.target);
      },
      destroy() {
        diff.destroy();
        destroyed = true;
        generation += 1;
        code?.destroy();
        presence.release();
        document.removeEventListener("pointerdown", onPointerDown, true);
        awareness?.off("change", render);
        editor.off("transaction", onTransaction);
        editor.off("update", onEditableChange);
      }
    };
  };

export { createElementViewRenderer };
