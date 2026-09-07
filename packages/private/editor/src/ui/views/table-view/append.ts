import type { Editor } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { addColumn, addRow, TableMap } from "@tiptap/pm/tables";
import type { TableAxis } from "./types";
import { setTableColumnWidths } from "./columns";

const appendTableItems = (
  editor: Editor,
  pos: number,
  axis: TableAxis,
  count: number,
  widths: number[]
): boolean => {
  const tr = editor.state.tr;

  if (count < 1) return false;

  for (let index = 0; index < count; index += 1) {
    const table = tr.doc.nodeAt(pos);

    if (table?.type.name !== "table") return false;

    const map = TableMap.get(table);
    const rect = {
      table,
      map,
      tableStart: pos + 1,
      left: 0,
      top: 0,
      right: map.width,
      bottom: map.height
    };
    // Each helper needs positions and mappings from the same document.
    const insertion = EditorState.create({ doc: tr.doc }).tr;

    if (axis === "column") addColumn(insertion, rect, map.width);
    else addRow(insertion, rect, map.height);

    for (const step of insertion.steps) tr.step(step);
  }

  setTableColumnWidths(tr, pos, widths);

  editor.view.dispatch(tr);
  return true;
};

export { appendTableItems };
