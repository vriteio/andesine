import { type Transaction } from "@tiptap/pm/state";
import { Decoration, type EditorView } from "@tiptap/pm/view";
import { ySyncPluginKey } from "@tiptap/y-tiptap";

interface ClickedSideOptions {
  /** Whether a click is on the inside of the boundary, e.g. in a code box. */
  isInside(target: Element, event: MouseEvent): boolean;
  /** Applies a side clicked at the caret's position, which makes no selection to apply it with. */
  setSide(view: EditorView, inside: boolean): void;
}

/** On the editor while a drawn caret shows; hides the browser's caret. */
const BOUNDARY_CURSOR_ACTIVE_CLASS = "boundary-cursor-active";

/**
 * The caret at a boundary that is one position with two sides, e.g. a code box's edge or an entry
 * link's icon, drawn as a widget: before what's at the position (`side: -1`), or after it.
 * `inside` draws it in a box's style, e.g. inside a code's box.
 */
const createBoundaryCursor = (pos: number, side: number, inside = false) => {
  return Decoration.widget(
    pos,
    () => {
      const cursor = document.createElement("span");

      cursor.className = inside ? "boundary-cursor boundary-cursor--inside" : "boundary-cursor";
      cursor.setAttribute("aria-hidden", "true");

      return cursor;
    },
    { side, key: `boundary-cursor-${side}-${inside}` }
  );
};
/** Whether a transaction applies another person's change, or an undo, from collaboration. */
const isRemoteChange = (transaction: Transaction) => {
  return Boolean(transaction.getMeta(ySyncPluginKey)?.isChangeOrigin);
};
/**
 * The side of a boundary that the last click was on, e.g. inside or outside a code box. Both sides
 * are one position, so the side is applied with the click's selection, before the caret shows,
 * or at once when the click is at the caret's position.
 */
const createClickedSide = (options: ClickedSideOptions) => {
  let inside: boolean | null = null;

  return {
    mousedown: (view: EditorView, event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const clicked = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
      const { selection } = view.state;
      const isSamePosition = selection.empty && clicked === selection.from && event.button === 0;

      inside = Boolean(target && view.dom.contains(target) && options.isInside(target, event));

      if (isSamePosition) options.setSide(view, inside);

      return false;
    },
    /** The clicked side for transactions with the click's selection, or null. */
    get: (transactions: readonly Transaction[]) => {
      return transactions.some((transaction) => transaction.getMeta("pointer")) ? inside : null;
    }
  };
};

export { BOUNDARY_CURSOR_ACTIVE_CLASS, createBoundaryCursor, createClickedSide, isRemoteChange };
