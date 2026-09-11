import { EditorSelection } from "@codemirror/state";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { isBlockSelection } from "../../../extensions/block-selection";
import type { Editor, EditorEvents } from "@tiptap/core";
import type { EditorView } from "@codemirror/view";
import { Plugin, Selection, TextSelection } from "@tiptap/pm/state";

interface CodeBlockBridge {
  editor: Editor;
  getPos(): number | undefined;
  code: EditorView;
}

const codeViews = new WeakMap<HTMLElement, CodeBlockBridge>();
const findCodeView = (target: EventTarget | null): CodeBlockBridge | undefined => {
  const dom = target instanceof Element ? target.closest<HTMLElement>("[data-code-block]") : null;

  return dom ? codeViews.get(dom) : undefined;
};

const createCodeBlockNavigation = (editor: Editor) =>
  new Plugin({
    props: {
      handleKeyDown(view, event) {
        const { selection, doc } = view.state;
        const selectedCode = doc.nodeAt(selection.from);

        if (
          event.key === "Enter" &&
          isBlockSelection(selection) &&
          selectedCode?.type.name === "codeBlock" &&
          selection.to === selection.from + selectedCode.nodeSize
        ) {
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.create(doc, selection.from + 1))
              .scrollIntoView()
          );
          view.focus();
          return true;
        }
        const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
        const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
        const direction =
          event.key === "ArrowDown"
            ? "down"
            : event.key === "ArrowUp"
              ? "up"
              : forward
                ? "right"
                : "left";

        if (
          (!forward && !backward) ||
          event.isComposing ||
          event.defaultPrevented ||
          event.altKey ||
          event.metaKey ||
          event.ctrlKey
        )
          return false;
        if (
          selection instanceof TextSelection &&
          selection.$head.parent.type.name === "codeBlock"
        ) {
          const dom = view.nodeDOM(selection.$head.before());
          const bridge = dom instanceof HTMLElement ? codeViews.get(dom) : undefined;

          if (!bridge) return false;

          if (!selection.empty && !event.shiftKey) {
            view.dispatch(
              view.state.tr
                .setSelection(TextSelection.create(doc, forward ? selection.to : selection.from))
                .scrollIntoView()
            );
            return true;
          }
          const offset = selection.head - selection.$head.start();
          const cursor = EditorSelection.cursor(offset);
          const moved =
            direction === "up" || direction === "down"
              ? bridge.code.moveVertically(cursor, forward)
              : bridge.code.moveByChar(cursor, forward);
          const boundary = forward ? selection.$head.after() : selection.$head.before();
          const head =
            moved.head !== offset
              ? selection.$head.start() + moved.head
              : Selection.near(doc.resolve(boundary), forward ? 1 : -1).head;

          view.dispatch(
            view.state.tr
              .setSelection(
                TextSelection.between(
                  event.shiftKey ? selection.$anchor : doc.resolve(head),
                  doc.resolve(head)
                )
              )
              .scrollIntoView()
          );
          return true;
        }
        if (!(selection instanceof TextSelection) && !(selection instanceof GapCursor))
          return false;
        if (
          (!selection.empty && !event.shiftKey) ||
          (selection instanceof TextSelection && !view.endOfTextblock(direction))
        )
          return false;

        const boundary =
          selection instanceof GapCursor
            ? selection.head
            : forward
              ? selection.$head.after()
              : selection.$head.before();
        const $boundary = doc.resolve(boundary);
        const adjacent = forward ? $boundary.nodeAfter : $boundary.nodeBefore;

        if (adjacent?.type.name !== "codeBlock") return false;

        const head = forward ? boundary + 1 : boundary - 1;
        view.dispatch(
          view.state.tr
            .setSelection(TextSelection.create(doc, event.shiftKey ? selection.anchor : head, head))
            .scrollIntoView()
        );
        return true;
      }
    },
    view(view) {
      let anchor: number | null = null;
      let origin: CodeBlockBridge | undefined;
      let crossed = false;

      const position = (event: MouseEvent) => {
        const code = findCodeView(document.elementFromPoint(event.clientX, event.clientY));
        const pos = code?.getPos();

        if (code?.editor === editor && typeof pos === "number") {
          const offset = code.code.posAtCoords({ x: event.clientX, y: event.clientY }, false);
          return offset === null ? null : pos + 1 + offset;
        }
        return view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
      };
      const down = (event: MouseEvent) => {
        if (event.button !== 0 || !view.dom.contains(event.target as Node)) return;
        origin = findCodeView(event.target);
        anchor = event.shiftKey ? view.state.selection.anchor : position(event);
        crossed = false;
        const head = position(event);
        const startsInCode =
          anchor !== null && view.state.doc.resolve(anchor).parent.type.name === "codeBlock";

        if (
          event.shiftKey &&
          anchor !== null &&
          head !== null &&
          (origin || startsInCode) &&
          !view.state.doc.resolve(anchor).sameParent(view.state.doc.resolve(head))
        ) {
          crossed = true;
          event.preventDefault();
          event.stopImmediatePropagation();
          view.dispatch(
            view.state.tr.setSelection(
              TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head))
            )
          );
          view.focus();
        }
      };
      const move = (event: MouseEvent) => {
        if (anchor === null || event.buttons !== 1) return;
        const target = findCodeView(document.elementFromPoint(event.clientX, event.clientY));
        if (!crossed && (target === origin || (!target && !origin))) return;
        const head = position(event);
        if (head === null) return;
        crossed = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        view.dispatch(
          view.state.tr.setSelection(
            TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head))
          )
        );
        view.focus();
      };
      const mapAnchor = ({ transaction }: EditorEvents["transaction"]) => {
        if (anchor !== null) anchor = transaction.mapping.map(anchor);
      };
      const up = () => {
        anchor = null;
        origin = undefined;
        crossed = false;
      };

      editor.on("transaction", mapAnchor);
      view.dom.addEventListener("mousedown", down, true);
      document.addEventListener("mousemove", move, true);
      document.addEventListener("mouseup", up, true);
      return {
        destroy() {
          editor.off("transaction", mapAnchor);
          view.dom.removeEventListener("mousedown", down, true);
          document.removeEventListener("mousemove", move, true);
          document.removeEventListener("mouseup", up, true);
        }
      };
    }
  });

export { createCodeBlockNavigation, codeViews };
export type { CodeBlockBridge };
