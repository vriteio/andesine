import type { MenuItem } from "@andesine/components";
import type { Editor } from "@tiptap/core";
import { TableMap, columnIsHeader, rowIsHeader } from "@tiptap/pm/tables";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { isPositionInInheritedField } from "#editor/ui/block-utils";
import { DEFAULT_COLUMN_WIDTH, setTableColumnWidths } from "#editor/ui/views/table-view/columns";
import { getCachedElementRect } from "#editor/ui/block-control-sizing";
import { getTableContentWidth, getTableElement } from "#editor/ui/views/table-view/scroll";

type TableAction =
  "addColumnAfter" | "addRowAfter" | "toggleHeaderRow" | "toggleHeaderColumn" | "deleteTable";

const getSelectedTable = (editor: Editor) => {
  const { doc, selection } = editor.state;
  const node = doc.nodeAt(selection.from);
  const parent = selection.$from.parent;

  if (
    !isBlockSelection(selection) ||
    selection.ranges.length !== 1 ||
    node?.type.name !== "table" ||
    selection.to !== selection.from + node.nodeSize ||
    (parent !== doc && parent.type.name !== "fragment") ||
    isPositionInInheritedField(doc, selection.from)
  ) {
    return null;
  }

  return { node, pos: selection.from };
};
const fitColumnWidths = (widths: number[], availableWidth: number): number[] => {
  const weights = widths.map((width) => Math.max(DEFAULT_COLUMN_WIDTH, width));
  const targetWidth = Math.max(Math.round(availableWidth), weights.length * DEFAULT_COLUMN_WIDTH);
  const fittedWidths = Array.from({ length: weights.length }, () => 0);
  const flexibleColumns = new Set(weights.map((_, index) => index));

  let remainingWidth = targetWidth;

  while (flexibleColumns.size) {
    const totalWeight = Array.from(flexibleColumns).reduce(
      (total, index) => total + weights[index],
      0
    );
    const constrainedColumns = Array.from(flexibleColumns).filter((index) => {
      return (remainingWidth * weights[index]) / totalWeight < DEFAULT_COLUMN_WIDTH;
    });

    if (!constrainedColumns.length) {
      flexibleColumns.forEach((index) => {
        fittedWidths[index] = (remainingWidth * weights[index]) / totalWeight;
      });
      break;
    }

    constrainedColumns.forEach((index) => {
      fittedWidths[index] = DEFAULT_COLUMN_WIDTH;
      flexibleColumns.delete(index);
      remainingWidth -= DEFAULT_COLUMN_WIDTH;
    });
  }

  const roundedWidths = fittedWidths.map(Math.floor);
  const fractionalOrder = fittedWidths
    .map((width, index) => ({ fraction: width - roundedWidths[index], index }))
    .sort((a, b) => b.fraction - a.fraction);

  let remainder = targetWidth - roundedWidths.reduce((total, width) => total + width, 0);

  for (const { index } of fractionalOrder) {
    if (!remainder) break;

    roundedWidths[index] += 1;
    remainder -= 1;
  }

  return roundedWidths;
};
const setTableFullWidth = (editor: Editor): void => {
  const table = getSelectedTable(editor);

  if (!table || !editor.isEditable || editor.isDestroyed) return;

  const dom = editor.view.nodeDOM(table.pos);

  if (!(dom instanceof HTMLElement)) return;

  const tableElement = getTableElement(dom);
  const availableWidth = getTableContentWidth(dom);
  const map = TableMap.get(table.node);
  const columns = tableElement?.rows[0]?.cells;

  if (!columns || columns.length !== map.width || !availableWidth) return;

  const currentWidths = Array.from(columns, (column) => getCachedElementRect(editor, column).width);
  const widths = fitColumnWidths(currentWidths, availableWidth);
  const tr = editor.state.tr;

  setTableColumnWidths(tr, table.pos, widths);

  if (tr.docChanged) editor.view.dispatch(tr);
};
const runTableAction = (editor: Editor, action: TableAction): void => {
  const table = getSelectedTable(editor);

  if (!table || !editor.isEditable || editor.isDestroyed) return;

  const map = TableMap.get(table.node);
  const append = action === "addColumnAfter" || action === "addRowAfter";
  const toggleHeader = action === "toggleHeaderRow" || action === "toggleHeaderColumn";
  const cellOffset = map.map[append ? map.map.length - 1 : 0];
  const chain = editor.chain();

  if (!toggleHeader) chain.focus();

  chain.setTextSelection(table.pos + cellOffset + 3);
  chain[action]();

  if (action !== "deleteTable") {
    chain.command(({ tr, commands }) => {
      const pos = tr.mapping.map(table.pos, -1);
      const node = tr.doc.nodeAt(pos);

      if (node?.type.name !== "table") return false;

      return commands.setBlockSelection({
        from: pos,
        to: pos + node.nodeSize,
        depth: tr.doc.resolve(pos).depth
      });
    });
  }

  chain.run();
};
const createTableMenuItems = (editor: Editor): MenuItem[] => {
  const table = getSelectedTable(editor);

  if (!table) return [];

  const map = TableMap.get(table.node);
  const headerRow = rowIsHeader(map, table.node, 0);
  const headerColumn = columnIsHeader(map, table.node, 0);

  return [
    { label: "Table", type: "header" },
    {
      label: "Header row",
      icon: "i-tabler:table-row",
      selected: headerRow,
      closeOnSelect: false,
      onClick: () => runTableAction(editor, "toggleHeaderRow")
    },
    {
      label: "Header column",
      icon: "i-tabler:table-column",
      selected: headerColumn,
      closeOnSelect: false,
      onClick: () => runTableAction(editor, "toggleHeaderColumn")
    },
    {
      label: "Full width",
      icon: "i-tabler:arrows-horizontal",
      onClick: () => setTableFullWidth(editor)
    },
    {
      label: "Add column",
      icon: "i-tabler:arrow-bar-right",
      onClick: () => runTableAction(editor, "addColumnAfter")
    },
    {
      label: "Add row",
      icon: "i-tabler:arrow-bar-down",
      onClick: () => runTableAction(editor, "addRowAfter")
    },
    {
      label: "Delete table",
      icon: "i-lucide:trash",
      color: "danger",
      shortcut: "$mod+backspace",
      onClick: () => runTableAction(editor, "deleteTable")
    }
  ];
};

export { createTableMenuItems };
