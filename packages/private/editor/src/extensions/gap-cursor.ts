import { Gapcursor as BaseGapcursor } from "@tiptap/extension-gapcursor";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** The visible box of a block, e.g. a table without the space around it for its controls. */
const getVisibleRect = (dom: Node | null): DOMRect | null => {
  if (!(dom instanceof HTMLElement)) return null;

  const table = dom.querySelector(":scope [data-table-content] > table");

  return (table ?? dom).getBoundingClientRect();
};
/** Centers the gap cursor between the visible edges of the blocks around it, e.g. two callouts. */
const centerGapCursor = (view: EditorView): void => {
  const { selection } = view.state;
  const cursor = view.dom.querySelector<HTMLElement>(".ProseMirror-gapcursor");
  const parent = cursor?.offsetParent;

  if (!(selection instanceof GapCursor) || !cursor || !parent) return;

  const { $head } = selection;
  const before = $head.nodeBefore;
  const above = before && getVisibleRect(view.nodeDOM($head.pos - before.nodeSize));
  const below = $head.nodeAfter && getVisibleRect(view.nodeDOM($head.pos));
  const center =
    above && below ? (above.bottom + below.top) / 2 : (above?.bottom ?? below?.top ?? null);

  if (center === null) return;

  const parentTop = parent.getBoundingClientRect().top + parent.clientTop - parent.scrollTop;

  cursor.style.top = `${center - parentTop}px`;
};
const Gapcursor = BaseGapcursor.extend({
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          handleDOMEvents: {
            // Unfocused, the cursor is hidden and unplaced, e.g. when a code block's editor had focus.
            focus: (view) => {
              requestAnimationFrame(() => centerGapCursor(view));

              return false;
            }
          }
        },
        view: (view) => {
          centerGapCursor(view);

          return { update: centerGapCursor };
        }
      })
    ];
  }
});

export { Gapcursor };
