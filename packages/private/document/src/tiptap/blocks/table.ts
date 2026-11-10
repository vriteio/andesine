import {
  Table as BaseTable,
  TableCell as BaseTableCell,
  TableHeader as BaseTableHeader,
  TableRow
} from "@tiptap/extension-table";

const Table = BaseTable.extend({ group: "tableBlock" }).configure({ cellMinWidth: 80 });

const TableCell = BaseTableCell.extend({ content: "paragraph" });

const TableHeader = BaseTableHeader.extend({ content: "paragraph" });

export { Table, TableCell, TableHeader, TableRow };
