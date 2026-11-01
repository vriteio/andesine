import { EditorSelection } from "@codemirror/state";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { isBlockSelection } from "../../../extensions/block-selection";
import type { Editor, EditorEvents } from "@tiptap/core";
import { EditorView } from "@codemirror/view";
import { Plugin, PluginKey, Selection, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView as ProseMirrorView } from "@tiptap/pm/view";
import { rangeContainsCode } from "../../block-utils";
import { createVerticalAutoScroll, type ClientPosition } from "../../auto-scroll";
import { findNextStop, selectStop } from "../../keyboard-stops";

interface CodeBlockBridge {
  editor: Editor;
  getPos(): number | undefined;
  code: EditorView;
}

const codeViews = new WeakMap<HTMLElement, CodeBlockBridge>();
// Editors with a drag that crossed a code block's edge: ProseMirror keeps focus until its end.
const crossingDrags = new WeakSet<Editor>();
const CROSSING_SELECTION_META = "codeBlockCrossingSelection";
const mixedSelectionKey = new PluginKey<DecorationSet | null>("codeBlockMixedSelection");
const findCodeView = (target: EventTarget | null): CodeBlockBridge | undefined => {
  const dom = target instanceof Element ? target.closest<HTMLElement>("[data-code-block]") : null;

  return dom ? codeViews.get(dom) : undefined;
};

/** A text selection that includes a code block and also continues outside it. */
const isMixedSelection = ({ doc, selection }: EditorState): boolean => {
  const inOneParent = selection.$from.sameParent(selection.$to);

  if (!(selection instanceof TextSelection) || inOneParent) return false;

  return rangeContainsCode(doc, selection.from, selection.to);
};
const createMixedDecorations = (state: EditorState): DecorationSet | null => {
  if (!isMixedSelection(state)) return null;

  const { from, to } = state.selection;

  return DecorationSet.create(state.doc, [
    Decoration.inline(from, to, { class: "code-mixed-selection" })
  ]);
};
const collapseSelection = (view: ProseMirrorView, forward: boolean): boolean => {
  const { doc, selection } = view.state;

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(doc, forward ? selection.to : selection.from))
      .scrollIntoView()
  );
  return true;
};
// The native selection can't extend a mixed selection, as it's clamped or hidden in Safari.
const moveMixedHead = (view: ProseMirrorView, forward: boolean, vertical: boolean): boolean => {
  const { doc, selection } = view.state;
  const dir = forward ? 1 : -1;
  const getVerticalTarget = () => {
    const { left, top, bottom } = view.coordsAtPos(selection.head);

    return view.posAtCoords({ left, top: forward ? bottom + 4 : top - 4 })?.pos;
  };
  const target = vertical ? getVerticalTarget() : selection.head + dir;
  const $head = doc.resolve(target ?? selection.head);
  const head = $head.parent.inlineContent ? $head : Selection.near($head, dir).$head;

  view.dispatch(
    view.state.tr.setSelection(TextSelection.between(selection.$anchor, head)).scrollIntoView()
  );
  return true;
};
const handleNavigationKey = (editor: Editor, view: ProseMirrorView, event: KeyboardEvent) => {
  const { selection, doc } = view.state;
  const selectedCode = doc.nodeAt(selection.from);

  if (
    event.key === "Enter" &&
    isBlockSelection(selection) &&
    selectedCode?.type.name === "codeBlock" &&
    selection.to === selection.from + selectedCode.nodeSize
  ) {
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(doc, selection.from + 1)).scrollIntoView()
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

  const isIgnored =
    (!forward && !backward) ||
    event.isComposing ||
    event.defaultPrevented ||
    event.altKey ||
    event.metaKey ||
    event.ctrlKey;

  if (isIgnored) return false;

  if (selection instanceof TextSelection && selection.$head.parent.type.name === "codeBlock") {
    const bridge = findCodeView(view.nodeDOM(selection.$head.before()) as Element | null);

    if (!bridge) return false;

    if (!selection.empty && !event.shiftKey) return collapseSelection(view, forward);

    const offset = selection.head - selection.$head.start();
    const cursor = EditorSelection.cursor(offset);
    const moved =
      direction === "up" || direction === "down"
        ? bridge.code.moveVertically(cursor, forward)
        : bridge.code.moveByChar(cursor, forward);
    const boundary = forward ? selection.$head.after() : selection.$head.before();
    const dir = forward ? 1 : -1;
    const isLeaving = moved.head === offset && !event.shiftKey;
    // As the arrow keys elsewhere: to the next stop, e.g. a code group's next tab.
    const stop = isLeaving
      ? findNextStop(editor, { pos: selection.$head.before(), block: false }, dir)
      : null;

    if (stop) return selectStop(editor, stop, dir);

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

  if (mixedSelectionKey.getState(view.state)) {
    if (!event.shiftKey) return collapseSelection(view, forward);

    return moveMixedHead(view, forward, direction === "up" || direction === "down");
  }

  if (!(selection instanceof TextSelection) && !(selection instanceof GapCursor)) return false;

  const staysInBlock =
    (!selection.empty && !event.shiftKey) ||
    (selection instanceof TextSelection && !view.endOfTextblock(direction));

  if (staysInBlock) return false;

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
};
const createCodeBlockNavigation = (editor: Editor) => {
  // From a drag across a code block's edge or a block selection from the keyboard until the next
  // input: Safari moves a native selection into a code block, and reading it back would replace it.
  let keepSelection = false;

  return new Plugin({
    key: mixedSelectionKey,
    state: {
      init: (_, state) => createMixedDecorations(state),
      apply: (tr, value, _, state) => {
        return tr.selectionSet || tr.docChanged ? createMixedDecorations(state) : value;
      }
    },
    filterTransaction(tr) {
      const isOtherSelection =
        tr.selectionSet && !tr.docChanged && !tr.getMeta(CROSSING_SELECTION_META);

      return !keepSelection || !isOtherSelection;
    },
    props: {
      attributes: (state): Record<string, string> => {
        return mixedSelectionKey.getState(state) ? { "data-code-mixed-selection": "" } : {};
      },
      decorations: (state) => mixedSelectionKey.getState(state),
      // A position in a code block has no coordinates of its own, only the block's top.
      handleScrollToSelection: (view) => {
        const { $head } = view.state.selection;
        const inCode = $head.parent.type.name === "codeBlock";
        const code = inCode && findCodeView(view.nodeDOM($head.before()) as Element | null)?.code;

        if (!code) return false;

        code.dispatch({
          effects: EditorView.scrollIntoView(Math.min($head.parentOffset, code.state.doc.length), {
            y: "nearest"
          })
        });
        return true;
      },
      handleKeyDown: (view, event) => handleNavigationKey(editor, view, event)
    },
    view(view) {
      let anchor: number | null = null;
      let origin: CodeBlockBridge | undefined;
      let keyboardInput = false;

      const getContainer = () => {
        return view.dom.closest<HTMLElement>("[data-editor-scrollable-container]");
      };
      // A pointer outside the editor selects up to the closest visible content.
      const clampPoint = ({ clientX, clientY }: ClientPosition): ClientPosition => {
        const rect = getContainer()?.getBoundingClientRect();

        if (!rect) return { clientX, clientY };

        return {
          clientX: Math.min(rect.right - 1, Math.max(rect.left + 1, clientX)),
          clientY: Math.min(rect.bottom - 1, Math.max(rect.top + 1, clientY))
        };
      };
      const position = ({ clientX, clientY }: ClientPosition) => {
        const code = findCodeView(document.elementFromPoint(clientX, clientY));
        const pos = code?.getPos();

        if (code?.editor === editor && typeof pos === "number") {
          return pos + 1 + code.code.posAtCoords({ x: clientX, y: clientY }, false);
        }
        return view.posAtCoords({ left: clientX, top: clientY })?.pos ?? null;
      };
      const extendSelection = (head: number) => {
        if (anchor === null) return;

        const selection = TextSelection.between(
          view.state.doc.resolve(anchor),
          view.state.doc.resolve(head)
        );

        crossingDrags.add(editor);
        keepSelection = true;

        if (!selection.eq(view.state.selection)) {
          view.dispatch(
            view.state.tr.setSelection(selection).setMeta(CROSSING_SELECTION_META, true)
          );
        }

        if (!view.hasFocus()) view.focus();
      };
      // CodeMirror's auto-scroll can pick an ancestor that can't scroll, e.g. the code block itself.
      const autoScroll = createVerticalAutoScroll(getContainer, (point) => {
        const clamped = clampPoint(point);

        if (crossingDrags.has(editor)) {
          const head = position(clamped);

          if (head !== null) extendSelection(head);
          return;
        }

        if (!origin) return;

        origin.code.dispatch({
          selection: {
            anchor: origin.code.state.selection.main.anchor,
            head: origin.code.posAtCoords({ x: clamped.clientX, y: clamped.clientY }, false)
          }
        });
      });
      const down = (event: MouseEvent) => {
        if (event.button !== 0 || !view.dom.contains(event.target as Node)) return;

        const { doc, selection } = view.state;
        const head = position(event);

        origin = findCodeView(event.target);
        anchor = event.shiftKey ? selection.anchor : head;
        crossingDrags.delete(editor);

        if (anchor === null || head === null) return;

        const $anchor = doc.resolve(anchor);

        if (!event.shiftKey) {
          const startsInSelection =
            selection.$from.sameParent($anchor) && selection.$to.sameParent($anchor);

          // A code block under a selection from outside can't take focus, so it would lose the click.
          if (origin && !selection.empty && !startsInSelection) {
            view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, head)));
          }

          return;
        }

        const startsInCode = origin || $anchor.parent.type.name === "codeBlock";

        if (startsInCode && !$anchor.sameParent(doc.resolve(head))) {
          event.preventDefault();
          event.stopImmediatePropagation();
          extendSelection(head);
        }
      };
      const move = (event: MouseEvent) => {
        if (anchor === null) return;

        // The release can happen where the document gets no event, e.g. over an iframe.
        if (event.buttons !== 1) {
          up();
          return;
        }

        const point = clampPoint(event);
        const target = findCodeView(document.elementFromPoint(point.clientX, point.clientY));
        const isCrossing = crossingDrags.has(editor) || target !== origin;

        // Text-only drags are native, with the browser's own auto-scroll.
        if (origin || isCrossing) autoScroll.update(event);
        if (!isCrossing) return;

        const head = position(point);

        if (head === null) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        extendSelection(head);
      };
      // Before other handlers, as the block selection's Shift+arrows would select whole blocks.
      // Safari can also move focus out of the editor when the native selection ends in a code block.
      const routeKey = (event: KeyboardEvent) => {
        const target = event.target as Node;
        const inEditor = target === document.body || view.dom.contains(target);

        if (!inEditor || !mixedSelectionKey.getState(view.state)) return;

        if (!view.hasFocus()) view.focus();

        if (handleNavigationKey(editor, view, event)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      // A click's cursor comes with `selectionchange`, which a fast key would be ahead of.
      const syncClickedCursor = () => {
        const { doc, selection, tr } = view.state;
        const native = document.getSelection();
        const isCursorSelection = isBlockSelection(selection) || selection instanceof TextSelection;

        if (document.activeElement !== view.dom || !isCursorSelection) return;
        if (!native?.isCollapsed || !native.focusNode || !view.dom.contains(native.focusNode))
          return;

        const cursor = Selection.near(
          doc.resolve(view.posAtDOM(native.focusNode, native.focusOffset))
        );

        if (!cursor.eq(selection)) view.dispatch(tr.setSelection(cursor));
      };
      const endKeepSelection = (event: PointerEvent | KeyboardEvent) => {
        if (event instanceof KeyboardEvent && !keyboardInput) syncClickedCursor();

        keyboardInput = event instanceof KeyboardEvent;

        if (!keepSelection) return;

        const keepsSelection =
          event instanceof KeyboardEvent &&
          (["Meta", "Control", "Shift", "Alt"].includes(event.key) ||
            ((event.metaKey || event.ctrlKey) && ["c", "x"].includes(event.key.toLowerCase())));

        if (!keepsSelection) keepSelection = false;
      };
      const mapAnchor = ({ transaction }: EditorEvents["transaction"]) => {
        if (anchor !== null) anchor = transaction.mapping.map(anchor);
      };
      const up = () => {
        const crossed = crossingDrags.delete(editor);

        autoScroll.stop();

        // Code blocks update on a transaction; one with the selection inside then takes focus.
        if (crossed) {
          view.dispatch(view.state.tr);

          if (!view.hasFocus()) view.focus();
        }

        anchor = null;
        origin = undefined;
      };

      editor.on("transaction", mapAnchor);
      view.dom.addEventListener("mousedown", down, true);
      document.addEventListener("pointerdown", endKeepSelection, true);
      document.addEventListener("keydown", endKeepSelection, true);
      document.addEventListener("keydown", routeKey, true);
      document.addEventListener("mousemove", move, true);
      document.addEventListener("mouseup", up, true);
      return {
        update() {
          if (keyboardInput && isBlockSelection(view.state.selection)) keepSelection = true;
        },
        destroy() {
          autoScroll.stop();
          crossingDrags.delete(editor);
          editor.off("transaction", mapAnchor);
          view.dom.removeEventListener("mousedown", down, true);
          document.removeEventListener("pointerdown", endKeepSelection, true);
          document.removeEventListener("keydown", endKeepSelection, true);
          document.removeEventListener("keydown", routeKey, true);
          document.removeEventListener("mousemove", move, true);
          document.removeEventListener("mouseup", up, true);
        }
      };
    }
  });
};

export { createCodeBlockNavigation, codeViews, crossingDrags };
export type { CodeBlockBridge };
