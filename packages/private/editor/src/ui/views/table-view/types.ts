import type { NodeViewRendererProps } from "@tiptap/core";
import type { TableView } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Accessor } from "solid-js";

interface TableControlsProps {
  editor: NodeViewRendererProps["editor"];
  getPos: NodeViewRendererProps["getPos"];
  node: Accessor<ProseMirrorNode>;
  editable: Accessor<boolean>;
  view: TableView;
}
interface TableLayout {
  columns: DOMRect[];
  rows: DOMRect[];
  table: DOMRect;
  wrapper: DOMRect;
}
interface TableDrag {
  axis: TableAxis;
  index: number;
  boundary: number;
  pointerID: number;
  pointerType: string;
  target: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  node: ProseMirrorNode;
}

type TableAxis = "column" | "row";

export type { TableAxis, TableControlsProps, TableDrag, TableLayout };
