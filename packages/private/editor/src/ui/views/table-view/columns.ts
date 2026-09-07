import type { Transaction } from "@tiptap/pm/state";
import { TableMap } from "@tiptap/pm/tables";

const DEFAULT_COLUMN_WIDTH = 80;
const setTableColumnWidths = (tr: Transaction, pos: number, widths: number[]): void => {
  const table = tr.doc.nodeAt(pos);

  if (table?.type.name !== "table") return;

  const map = TableMap.get(table);

  for (const offset of new Set(map.map)) {
    const cell = table.nodeAt(offset)!;
    const column = map.colCount(offset);
    const colwidth = Array.from(
      { length: cell.attrs.colspan },
      (_, index) => widths[column + index] ?? DEFAULT_COLUMN_WIDTH
    );

    if (
      cell.attrs.colwidth?.length !== colwidth.length ||
      colwidth.some((width, index) => width !== cell.attrs.colwidth[index])
    ) {
      tr.setNodeMarkup(pos + offset + 1, undefined, { ...cell.attrs, colwidth });
    }
  }
};

export { DEFAULT_COLUMN_WIDTH, setTableColumnWidths };
