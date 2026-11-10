import { countColumn } from "@codemirror/state";
import { foldGutter, getIndentUnit } from "@codemirror/language";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from "@codemirror/view";

const getIndentGuides = (view: EditorView): DecorationSet => {
  const ranges = [];
  const unit = getIndentUnit(view.state);
  const { doc, tabSize } = view.state;

  let lastLine = 0;

  for (const visible of view.visibleRanges) {
    let line = doc.lineAt(visible.from);

    while (line.from <= visible.to) {
      if (line.number > lastLine) {
        const whitespace = line.text.match(/^[\t ]*/)?.[0] || "";
        const columns = countColumn(whitespace, tabSize);

        if (columns >= unit) {
          ranges.push(
            Decoration.line({
              attributes: {
                class: "code-block-indent-guides",
                style: `--code-indent-width: ${columns}ch; --code-indent-unit: ${unit}ch`
              }
            }).range(line.from)
          );
        }
        lastLine = line.number;
      }
      if (line.number === doc.lines) break;
      line = doc.line(line.number + 1);
    }
  }
  return Decoration.set(ranges);
};

const codeBlockIndentGuides = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getIndentGuides(view);
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.transactions.some((transaction) => transaction.reconfigured)
      ) {
        this.decorations = getIndentGuides(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
);
const codeBlockFoldGutter = foldGutter({
  markerDOM(open) {
    const marker = document.createElement("span");

    marker.className = open
      ? "code-block-fold-icon code-block-fold-icon-open"
      : "code-block-fold-icon";
    marker.setAttribute("aria-label", open ? "Fold code" : "Unfold code");
    return marker;
  }
});

export { codeBlockIndentGuides, codeBlockFoldGutter };
