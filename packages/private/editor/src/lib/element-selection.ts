import { GapCursor } from "@tiptap/pm/gapcursor";
import { Selection, type Transaction } from "@tiptap/pm/state";
import { createBlockRangeSelection } from "../extensions/block-selection";

const setElementExitSelection = (
  tr: Transaction,
  position: number,
  action: "enter" | "down" | "up" | "cancel"
): void => {
  const node = tr.doc.nodeAt(position)!;

  if (action === "cancel") {
    tr.setSelection(
      createBlockRangeSelection(tr.doc, {
        from: position,
        to: position + node.nodeSize,
        depth: tr.doc.resolve(position).depth
      })
    );
    return;
  }
  if (action === "down" || action === "up") {
    const down = action === "down";
    const target = down ? position + (node.attrs.selfClosing ? node.nodeSize : 1) : position;
    const $target = tr.doc.resolve(target);
    // Resolving a bookmark checks whether this position supports a gap cursor.
    const gap = new GapCursor($target).getBookmark().resolve(tr.doc);

    tr.setSelection(gap instanceof GapCursor ? gap : Selection.near($target, down ? 1 : -1));
    return;
  }
  if (!node.attrs.selfClosing) {
    if (!node.childCount) {
      tr.insert(position + 1, tr.doc.type.schema.nodes.paragraph.create());
    }
    tr.setSelection(Selection.near(tr.doc.resolve(position + 1), 1));
  } else {
    const after = position + node.nodeSize;

    if (!tr.doc.nodeAt(after)) {
      tr.insert(after, tr.doc.type.schema.nodes.paragraph.create());
    }
    tr.setSelection(Selection.near(tr.doc.resolve(after), 1));
  }
};

export { setElementExitSelection };
