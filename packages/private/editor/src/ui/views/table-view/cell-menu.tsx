import type { EditorEvents } from "@tiptap/core";
import { DropdownArea, DropdownMenu, IconButton, type MenuItem } from "@andesine/components";
import clsx from "clsx";
import {
  CellSelection,
  columnIsHeader,
  rowIsHeader,
  selectedRect,
  type TableRect
} from "@tiptap/pm/tables";
import { type Accessor, createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { TableControlsProps, TableLayout } from "./types";

interface TableMenuPoint {
  x: number;
  y: number;
}
interface TableCellMenuProps extends TableControlsProps {
  layout: Accessor<TableLayout | null>;
  enabled: Accessor<boolean>;
  anchor: Accessor<TableMenuPoint | null>;
  setAnchor(point: TableMenuPoint | null): void;
}

type CellAction =
  | "addColumnBefore"
  | "addColumnAfter"
  | "addRowBefore"
  | "addRowAfter"
  | "deleteColumn"
  | "deleteRow"
  | "toggleHeaderRow"
  | "toggleHeaderColumn"
  | "deleteTable";

const TableCellMenu = (props: TableCellMenuProps) => {
  const [selection, setSelection] = createSignal<TableRect | null>(null);
  const [positioned, setPositioned] = createSignal(false);

  let contextMenuOpened = false;
  let contextPointerDown = false;
  let menuFrame: number | null = null;

  const getSelection = () => {
    const { state } = props.editor;
    const pos = props.getPos();

    if (
      !props.enabled() ||
      !(state.selection instanceof CellSelection) ||
      typeof pos !== "number" ||
      state.selection.$anchorCell.start(-1) !== pos + 1
    ) {
      return null;
    }

    return selectedRect(state);
  };
  const corner = () => {
    const rect = selection();
    const layout = props.layout();
    const column = rect && layout?.columns[rect.right - 1];
    const row = rect && layout?.rows[rect.bottom - 1];

    return column && row && layout
      ? { x: column.right - layout.wrapper.left, y: row.bottom - layout.wrapper.top }
      : null;
  };
  const run = (action: CellAction) => {
    if (props.editor.isDestroyed || !getSelection()) return;

    props.editor.commands[action]();
  };
  const items = (): MenuItem[][] => {
    const rect = selection();
    const columns: MenuItem[] = [
      {
        label: "Add left",
        icon: "i-tabler:arrow-bar-left",
        onClick: () => run("addColumnBefore")
      },
      {
        label: "Add right",
        icon: "i-tabler:arrow-bar-right",
        onClick: () => run("addColumnAfter")
      }
    ];
    const rows: MenuItem[] = [
      { label: "Add above", icon: "i-tabler:arrow-bar-up", onClick: () => run("addRowBefore") },
      { label: "Add below", icon: "i-tabler:arrow-bar-down", onClick: () => run("addRowAfter") }
    ];

    if (!rect) return [];

    if (rect.left === 0) {
      columns.unshift({
        label: "Header column",
        icon: "i-tabler:table-column",
        selected: columnIsHeader(rect.map, rect.table, 0),
        closeOnSelect: false,
        onClick: () => run("toggleHeaderColumn")
      });
    }

    if (rect.right - rect.left < rect.map.width) {
      columns.push({
        label: rect.right - rect.left === 1 ? "Delete column" : "Delete columns",
        icon: "i-tabler:column-remove",
        onClick: () => run("deleteColumn")
      });
    }

    if (rect.top === 0) {
      rows.unshift({
        label: "Header row",
        icon: "i-tabler:table-row",
        selected: rowIsHeader(rect.map, rect.table, 0),
        closeOnSelect: false,
        onClick: () => run("toggleHeaderRow")
      });
    }

    if (rect.bottom - rect.top < rect.map.height) {
      rows.push({
        label: rect.bottom - rect.top === 1 ? "Delete row" : "Delete rows",
        icon: "i-tabler:row-remove",
        onClick: () => run("deleteRow")
      });
    }

    return [
      [{ label: "Columns", type: "header" }, ...columns],
      [{ label: "Rows", type: "header" }, ...rows],
      [
        {
          label: "Delete table",
          icon: "i-lucide:trash",
          color: "danger",
          onClick: () => run("deleteTable")
        }
      ]
    ];
  };
  const openContextMenu = (event: MouseEvent, menuOpened = Boolean(props.anchor())) => {
    const anchor = { x: event.clientX, y: event.clientY };
    const cell = event.target instanceof Element ? event.target.closest("td, th") : null;
    const tablePos = props.getPos();

    if (menuFrame !== null) cancelAnimationFrame(menuFrame);
    menuFrame = null;

    if (
      !props.enabled() ||
      !cell ||
      !props.view.table.contains(cell) ||
      typeof tablePos !== "number"
    ) {
      return false;
    }

    const cellPos = props.editor.view.posAtDOM(cell, 0) - 1;
    const current = props.editor.state.selection;

    let insideSelection = false;

    if (current instanceof CellSelection) {
      current.forEachCell((_, pos) => {
        if (pos === cellPos) insideSelection = true;
      });
    }

    event.preventDefault();
    if (insideSelection && menuOpened) {
      props.setAnchor(null);
      props.editor.commands.setBlockSelection({
        from: tablePos,
        to: tablePos + props.node().nodeSize,
        depth: props.editor.state.doc.resolve(tablePos).depth
      });
      // Let the outer block menu handle this right-click.
      return true;
    }

    event.stopPropagation();
    if (!insideSelection) {
      props.editor.view.dispatch(
        props.editor.state.tr.setSelection(CellSelection.create(props.editor.state.doc, cellPos))
      );
    }

    const { doc, selection: cellSelection } = props.editor.state;

    props.setAnchor(null);
    // Safari updates its native selection after the context-menu event.
    // Open after that update and restore the cell range before moving focus.
    menuFrame = requestAnimationFrame(() => {
      menuFrame = null;
      if (props.editor.isDestroyed || props.editor.state.doc !== doc || !props.enabled()) return;

      props.editor.view.dispatch(props.editor.state.tr.setSelection(cellSelection));
      props.setAnchor(anchor);
    });

    return true;
  };
  const handleContextMenu = (event: MouseEvent) => {
    if (contextPointerDown) {
      contextPointerDown = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    openContextMenu(event);
  };
  const capturePointerDown = () => {
    // Read this before the dropdown handles a pointer press outside its menu.
    contextMenuOpened = Boolean(props.anchor());
  };
  const handlePointerDown = (event: PointerEvent) => {
    contextPointerDown = event.button === 2 && openContextMenu(event, contextMenuOpened);
  };

  createEffect(() => {
    props.anchor();
    setPositioned(false);
  });
  createEffect(() => {
    props.enabled();
    props.node();
    const current = getSelection();

    setSelection(current);
    if (!current) props.setAnchor(null);
  });
  onMount(() => {
    const update = ({ transaction }: EditorEvents["transaction"]) => {
      if (!transaction.docChanged && !transaction.selectionSet) return;

      const current = getSelection();

      setSelection(current);
      if (!current) props.setAnchor(null);
    };

    props.editor.on("transaction", update);
    window.addEventListener("pointerdown", capturePointerDown, true);
    props.view.table.addEventListener("pointerdown", handlePointerDown, true);
    props.view.table.addEventListener("contextmenu", handleContextMenu, true);
    onCleanup(() => {
      if (menuFrame !== null) cancelAnimationFrame(menuFrame);

      props.editor.off("transaction", update);
      window.removeEventListener("pointerdown", capturePointerDown, true);
      props.view.table.removeEventListener("pointerdown", handlePointerDown, true);
      props.view.table.removeEventListener("contextmenu", handleContextMenu, true);
    });
  });

  return (
    <DropdownArea enabled={() => false}>
      <DropdownMenu
        title="Cell actions"
        anchorPoint={props.anchor()}
        opened={Boolean(props.anchor())}
        setOpened={(opened) => {
          if (!opened) props.setAnchor(null);
        }}
        placement="bottom-start"
        onPlacementChange={() => setPositioned(true)}
        class="absolute inset-0 pointer-events-none"
        cardProps={{
          class: clsx("w-52", !positioned() && "md:invisible!"),
          ...{ "data-table-cell-menu": "", "data-menu": "" }
        }}
        items={items()}
        trigger={() => (
          <Show when={corner()}>
            {(point) => (
              <IconButton
                icon="i-lucide:ellipsis-vertical"
                iconProps={{ style: { width: "12px", height: "12px" } }}
                aria-label="Cell actions"
                variant="outlined"
                color="contrast"
                size="xs"
                text="softer"
                class="absolute z-40 pointer-events-auto h-4 w-4 p-0 rounded-[0.25rem]"
                style={{
                  left: `${point().x + 8}px`,
                  top: `${point().y + 8}px`,
                  transform: "translate(-100%, -100%)"
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();

                  event.preventDefault();
                  event.stopPropagation();
                  props.setAnchor({ x: rect.right, y: rect.bottom });
                }}
              />
            )}
          </Show>
        )}
      />
    </DropdownArea>
  );
};

export { TableCellMenu };
export type { TableMenuPoint };
