import {
  Table as BaseTable,
  TableCell as BaseTableCell,
  TableHeader as BaseTableHeader,
  TableRow
} from "@tiptap/extension-table";
import { Plugin } from "@tiptap/pm/state";
import { normalizePastedCellContent, normalizePastedTables } from "./table-paste";

// The node view provides pointer-based column resize handles.
const Table = BaseTable.extend({
  group: "tableBlock",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPastedHTML: normalizePastedTables,
          transformPasted: normalizePastedCellContent
        }
      }),
      ...(this.parent?.() || [])
    ];
  },
  addCommands() {
    return {
      ...this.parent?.(),
      mergeCells: () => () => false,
      splitCell: () => () => false,
      mergeOrSplit: () => () => false
    };
  }
}).configure({ View: null, cellMinWidth: 80 });
const TableCell = BaseTableCell.extend({ content: "paragraph" });
const TableHeader = BaseTableHeader.extend({ content: "paragraph" });

export { Table, TableCell, TableHeader, TableRow };
