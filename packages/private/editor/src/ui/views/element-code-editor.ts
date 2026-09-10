import { EditorState, Prec } from "@codemirror/state";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  insertNewlineAndIndent,
  insertNewlineKeepIndent,
  isolateHistory
} from "@codemirror/commands";
import { formatElement, getElementTagName, parseElement, tokenizeElement } from "../../lib/element";

interface ElementCodeEditorOptions {
  parent: HTMLElement;
  source: string;
  selectName: boolean;
  edge?: "start" | "end";
  onChange(source: string): void;
  finish(action: "enter" | "down" | "up" | "cancel" | "blur"): void;
}

const highlight = (source: string): DecorationSet => {
  return Decoration.set(
    tokenizeElement(source).map(({ from, to, kind }) =>
      Decoration.mark({ class: `element-token-${kind}` }).range(from, to)
    )
  );
};
const formatTagDraft = (view: EditorView): boolean => {
  const source = view.state.doc.toString();
  const cursor = view.state.selection.main.head;
  const oldTokens = tokenizeElement(source);
  const index = oldTokens.findIndex((token) => token.to >= cursor);
  let formatted: string;

  try {
    formatted = formatElement(parseElement(source));
  } catch {
    return true;
  }
  if (source === formatted) {
    return true;
  }
  const token = tokenizeElement(formatted)[index];
  const position = token
    ? Math.min(token.to, token.from + Math.max(0, cursor - oldTokens[index].from))
    : formatted.length;

  view.dispatch({
    changes: { from: 0, to: source.length, insert: formatted },
    selection: { anchor: position },
    userEvent: "input.format",
    annotations: isolateHistory.of("full")
  });
  return true;
};
const createElementCodeEditor = (options: ElementCodeEditorOptions): EditorView => {
  const source = options.source.replace(/\r\n?/g, "\n");
  const desktop = window.matchMedia("(min-width: 768px)");
  const tokens = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = highlight(view.state.doc.toString());
      }
      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = highlight(update.state.doc.toString());
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
  const finish =
    (action: Parameters<ElementCodeEditorOptions["finish"]>[0]) =>
    (view: EditorView): boolean => {
      if (view.composing) {
        return false;
      }
      options.finish(action);
      return true;
    };
  const enter = (view: EditorView): boolean => {
    const { main } = view.state.selection;
    const { doc } = view.state;
    const atTagEnd =
      main.empty &&
      main.head === doc.length &&
      doc.sliceString(Math.max(0, doc.length - 1)) === ">";

    if (view.composing) return false;
    if (!desktop.matches && !atTagEnd) return insertNewlineKeepIndent(view);

    return finish("enter")(view);
  };
  const leaveOnArrow =
    (direction: "down" | "up" | "left" | "right") =>
    (view: EditorView): boolean => {
      const { main } = view.state.selection;
      const forward = direction === "down" || direction === "right";
      const boundaryPosition = forward ? view.state.doc.length : 0;

      if (view.composing || !main.empty) {
        return false;
      }
      if (direction === "left" || direction === "right") {
        if (main.head !== boundaryPosition) return false;
      } else {
        const cursor = view.coordsAtPos(main.head);
        const boundary = view.coordsAtPos(boundaryPosition);

        if (!cursor || !boundary || Math.abs(cursor.top - boundary.top) > 1) return false;
      }
      options.finish(forward ? "down" : "up");
      return true;
    };
  const name = getElementTagName(source);
  const start = source.indexOf("<") + 1;
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: source,
      selection:
        options.selectName && name
          ? { anchor: start, head: start + name.length }
          : { anchor: options.edge === "start" ? 0 : source.length },
      extensions: [
        history(),
        closeBrackets(),
        bracketMatching(),
        EditorState.languageData.of(() => [{ closeBrackets: { brackets: ["[", "{", '"'] } }]),
        EditorView.lineWrapping,
        tokens,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            options.onChange(update.state.doc.toString());
          }
        }),
        Prec.highest(
          keymap.of([
            { key: "Enter", run: enter, stopPropagation: true },
            { key: "Shift-Enter", run: insertNewlineAndIndent },
            { key: "Escape", run: finish("cancel"), stopPropagation: true },
            { key: "ArrowDown", run: leaveOnArrow("down"), stopPropagation: true },
            { key: "ArrowUp", run: leaveOnArrow("up"), stopPropagation: true },
            { key: "ArrowRight", run: leaveOnArrow("right"), stopPropagation: true },
            { key: "ArrowLeft", run: leaveOnArrow("left"), stopPropagation: true },
            indentWithTab,
            { key: "Mod-Shift-f", run: formatTagDraft }
          ])
        ),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
        EditorView.contentAttributes.of({
          "aria-label": "Element opening tag",
          "spellcheck": "false"
        }),
        EditorView.domEventHandlers({
          blur: () => {
            queueMicrotask(() => options.finish("blur"));
            return false;
          }
        }),
        EditorView.theme({
          "&": { backgroundColor: "transparent", fontSize: "inherit", lineHeight: "inherit" },
          "&.cm-focused": { outline: "none" },
          ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", overflow: "visible" },
          ".cm-content": { padding: "0", minHeight: "0", caretColor: "currentColor" },
          ".cm-line": { padding: "0" }
        })
      ]
    })
  });

  view.focus();
  if (options.edge) {
    view.dispatch({
      effects: EditorView.scrollIntoView(view.state.selection.main, { y: "nearest", x: "nearest" })
    });
  }
  return view;
};

export { createElementCodeEditor, formatTagDraft };
