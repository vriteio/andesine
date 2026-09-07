import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { columnIsHeader, rowIsHeader, TableMap } from "@tiptap/pm/tables";
import { createMemo, For } from "solid-js";
import { Dynamic } from "solid-js/web";
import { DEFAULT_COLUMN_WIDTH } from "./columns";
import type { TableAxis, TableLayout } from "./types";

interface TableExtensionPreviewProps {
  node: ProseMirrorNode;
  layout: TableLayout;
  axis: TableAxis;
  count: number;
  rowHeight: number;
}

const TableExtensionPreview = (props: TableExtensionPreviewProps) => {
  const map = createMemo(() => TableMap.get(props.node));
  const columns = createMemo(() =>
    props.axis === "column"
      ? Array.from({ length: props.count }, () => DEFAULT_COLUMN_WIDTH)
      : props.layout.columns.map((column) => column.width)
  );
  const rows = createMemo(() =>
    props.axis === "row"
      ? Array.from({ length: props.count }, () => props.rowHeight)
      : props.layout.rows.map((row) => row.height)
  );
  const usesBodyCells = createMemo(() =>
    props.axis === "column"
      ? columnIsHeader(map(), props.node, map().width - 1)
      : rowIsHeader(map(), props.node, map().height - 1)
  );
  const isHeader = (row: number, column: number) => {
    const tableMap = map();
    const offset =
      props.axis === "column"
        ? row * tableMap.width + tableMap.width - 1
        : (tableMap.height - 1) * tableMap.width + column;

    return !usesBodyCells() && props.node.nodeAt(tableMap.map[offset])?.type.name === "tableHeader";
  };

  return (
    <div
      aria-hidden="true"
      data-table-extension-preview
      class="absolute pointer-events-none opacity-50"
      style={{
        left: `${(props.axis === "column" ? props.layout.table.right : props.layout.table.left) - props.layout.wrapper.left}px`,
        top: `${(props.axis === "row" ? props.layout.table.bottom : props.layout.table.top) - props.layout.wrapper.top}px`
      }}
    >
      <table
        style={{
          position: "absolute",
          left: "-0.5px",
          top: "-0.5px",
          margin: "0",
          width: `${columns().reduce((sum, width) => sum + width, 0) + 1}px`
        }}
      >
        <colgroup>
          <For each={columns()}>{(width) => <col style={{ width: `${width}px` }} />}</For>
        </colgroup>
        <tbody>
          <For each={rows()}>
            {(height, row) => (
              <tr style={{ height: `${height}px` }}>
                <For each={columns()}>
                  {(_, column) => <Dynamic component={isHeader(row(), column()) ? "th" : "td"} />}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};

export { TableExtensionPreview };
