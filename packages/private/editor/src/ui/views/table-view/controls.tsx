import { scrollTableDrag } from "./edge-scroll";
import {
  getCachedElementRect,
  getBlockControlLayoutVersion,
  invalidateBlockControlLayout
} from "#editor/ui/block-control-sizing";
import { IconButton } from "@andesine/components";
import { createMediaQuery } from "@solid-primitives/media";
import { CellSelection, moveTableColumn, moveTableRow, TableMap } from "@tiptap/pm/tables";
import clsx from "clsx";
import {
  createEffect,
  createSignal,
  For,
  Index,
  onCleanup,
  onMount,
  Show,
  untrack
} from "solid-js";
import { isPositionInInheritedField } from "#editor/ui/block-utils";
import { createTableInteractionState } from "./interaction";
import { TableResizeControls } from "./resize";
import { TableExtensionControls } from "./extend";
import { TableCellMenu, type TableMenuPoint } from "./cell-menu";
import type { TableAxis, TableControlsProps, TableDrag, TableLayout } from "./types";

const HANDLE_SPACE = 24;
const INDICATOR_SIDE_SPACING = 8;
const INDICATOR_CENTERING_OFFSET = -0.5;
const TableControls = (props: TableControlsProps) => {
  const touchInput = createMediaQuery("(hover: none) and (pointer: coarse)");
  const [layout, setLayout] = createSignal<TableLayout | null>(null);
  const [drag, setDrag] = createSignal<TableDrag | null>(null);
  const [resizing, setResizing] = createSignal(false);
  const [extending, setExtending] = createSignal(false);
  const [menuAnchor, setMenuAnchor] = createSignal<TableMenuPoint | null>(null);
  const { selectedCells, selectingCells } = createTableInteractionState(props, () =>
    Boolean(drag() || resizing() || extending())
  );

  let measureFrame: number | null = null;
  let scrollFrame: number | null = null;
  let layoutVersion = -1;

  const canEdit = () => {
    const pos = props.getPos();

    props.node();

    return (
      props.editable() &&
      props.editor.isEditable &&
      typeof pos === "number" &&
      !isPositionInInheritedField(props.editor.state.doc, pos)
    );
  };
  const measure = () => {
    const { table, dom } = props.view;

    if (!dom.isConnected) return;

    const version = getBlockControlLayoutVersion(props.editor);

    if (layoutVersion === version) return;
    layoutVersion = version;

    // Safari does not expose layout bounds for <col> elements.
    const columns = Array.from(table.rows[0]?.cells || [], (cell) =>
      getCachedElementRect(props.editor, cell)
    );
    const rows = Array.from(table.rows, (row) => getCachedElementRect(props.editor, row));

    if (!columns.length || !rows.length) return;

    setLayout({
      columns,
      rows,
      table: getCachedElementRect(props.editor, table),
      wrapper: getCachedElementRect(props.editor, dom)
    });
  };

  const scheduleMeasure = () => {
    if (measureFrame !== null) return;

    measureFrame = requestAnimationFrame(() => {
      measureFrame = null;
      measure();
    });
  };
  const stopDrag = () => {
    const current = drag();

    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    setDrag(null);
    if (current) document.documentElement.removeAttribute("data-table-dragging");
    if (current?.target.hasPointerCapture(current.pointerID)) {
      current.target.releasePointerCapture(current.pointerID);
    }
  };
  const updateDrop = (current: TableDrag) => {
    const measured = layout();

    if (!measured) return;

    const rects = current.axis === "column" ? measured.columns : measured.rows;
    const coordinate = current.axis === "column" ? current.x : current.y;
    const boundary = rects.findIndex((rect) => {
      return (
        coordinate <
        (current.axis === "column" ? rect.left + rect.width / 2 : rect.top + rect.height / 2)
      );
    });

    setDrag({ ...current, boundary: boundary === -1 ? rects.length : boundary });
  };
  const autoScroll = () => {
    const current = drag();
    const container = props.view.dom.closest<HTMLElement>("[data-editor-scrollable-container]");
    const horizontalContainer = props.view.dom.closest<HTMLElement>(
      "[data-table-scroll-container]"
    );

    scrollFrame = null;
    if (!current?.active || !container || !horizontalContainer) return;

    const rect = getCachedElementRect(props.editor, container);
    const horizontalRect = getCachedElementRect(props.editor, horizontalContainer);
    const scrollLeft = horizontalContainer.scrollLeft;
    const scrollTop = container.scrollTop;

    scrollTableDrag(current, horizontalContainer, horizontalRect, container, rect);
    if (scrollLeft !== horizontalContainer.scrollLeft || scrollTop !== container.scrollTop) {
      invalidateBlockControlLayout(props.editor);
      measure();
    }
    updateDrop(current);
    scrollFrame = requestAnimationFrame(autoScroll);
  };
  const move = (axis: TableAxis, from: number, to: number) => {
    const pos = props.getPos();
    const command = axis === "column" ? moveTableColumn : moveTableRow;

    if (!canEdit() || typeof pos !== "number" || from === to) return;

    const map = TableMap.get(props.node());

    props.editor
      .chain()
      .setCellSelection({ anchorCell: pos + 1 + map.map[0] })
      .command(({ state, dispatch }) =>
        command({ from, to, pos: pos + 1, select: true })(state, dispatch)
      )
      .run();
  };
  const startDrag = (event: PointerEvent, axis: TableAxis, index: number) => {
    if (event.button !== 0 || !canEdit() || resizing() || extending() || selectingCells()) return;

    const target = event.currentTarget as HTMLElement;

    event.preventDefault();
    event.stopPropagation();
    target.setPointerCapture(event.pointerId);
    setMenuAnchor(null);
    measure();
    setDrag({
      axis,
      index,
      boundary: index,
      pointerID: event.pointerId,
      pointerType: event.pointerType,
      target,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      node: props.node()
    });
  };
  const movePointer = (event: PointerEvent) => {
    const current = drag();

    if (!current || current.pointerID !== event.pointerId) return;

    const active =
      current.active ||
      Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= 4;

    event.preventDefault();
    if (active && !current.active) {
      document.documentElement.setAttribute("data-table-dragging", "");
    }
    updateDrop({ ...current, x: event.clientX, y: event.clientY, active });
    if (active && scrollFrame === null) scrollFrame = requestAnimationFrame(autoScroll);
  };
  const selectCells = (axis: TableAxis, index: number, point: TableMenuPoint) => {
    const pos = props.getPos();

    if (!canEdit() || typeof pos !== "number") return;

    const map = TableMap.get(props.node());
    const first = axis === "column" ? index : index * map.width;
    const last = axis === "column" ? (map.height - 1) * map.width + index : first + map.width - 1;
    const selection = CellSelection.create(
      props.editor.state.doc,
      pos + 1 + map.map[first],
      pos + 1 + map.map[last]
    );

    props.editor.view.dispatch(props.editor.state.tr.setSelection(selection));
    setMenuAnchor(point);
  };
  const releasePointer = (event: PointerEvent) => {
    const current = drag();

    if (!current || current.pointerID !== event.pointerId) return;

    event.preventDefault();
    stopDrag();
    if (current.node !== props.node()) return;

    if (!current.active) {
      selectCells(current.axis, current.index, { x: event.clientX, y: event.clientY });
      return;
    }

    move(
      current.axis,
      current.index,
      current.boundary - (current.boundary > current.index ? 1 : 0)
    );
  };
  const cancelKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !drag()) return;

    event.preventDefault();
    event.stopPropagation();
    stopDrag();
  };
  const moveWithKeyboard = (event: KeyboardEvent, axis: TableAxis, index: number) => {
    const previous = axis === "column" ? "ArrowLeft" : "ArrowUp";
    const next = axis === "column" ? "ArrowRight" : "ArrowDown";
    const count = axis === "column" ? layout()?.columns.length : layout()?.rows.length;
    const target = index + (event.key === previous ? -1 : 1);

    if (
      !event.altKey ||
      ![previous, next].includes(event.key) ||
      target < 0 ||
      target >= (count || 0)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    move(axis, index, target);
  };

  createEffect(() => {
    const node = props.node();
    const current = untrack(drag);
    const editable = canEdit();

    if (current && (current.node !== node || !editable)) stopDrag();
    scheduleMeasure();
  });
  onMount(() => {
    const observer = new ResizeObserver(() => {
      invalidateBlockControlLayout(props.editor);
      scheduleMeasure();
    });
    observer.observe(props.view.table);
    observer.observe(props.view.dom);
    window.addEventListener("scroll", scheduleMeasure, true);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("pointermove", movePointer, { passive: false });
    window.addEventListener("pointerup", releasePointer, true);
    window.addEventListener("pointercancel", stopDrag);
    window.addEventListener("blur", stopDrag);
    window.addEventListener("keydown", cancelKey, true);
    scheduleMeasure();
    onCleanup(() => {
      observer.disconnect();
      if (measureFrame !== null) cancelAnimationFrame(measureFrame);
      stopDrag();
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", releasePointer, true);
      window.removeEventListener("pointercancel", stopDrag);
      window.removeEventListener("blur", stopDrag);
      window.removeEventListener("keydown", cancelKey, true);
    });
  });

  return (
    <Show when={canEdit() && layout()}>
      {(measured) => (
        <>
          <For each={["column", "row"] as const}>
            {(axis) => (
              <Index each={axis === "column" ? measured().columns : measured().rows}>
                {(rect, index) => (
                  <div
                    class="group absolute flex items-center justify-center pointer-events-auto"
                    data-table-handle={axis}
                    data-selected={
                      touchInput() &&
                      selectedCells() &&
                      (axis === "column"
                        ? index === selectedCells()!.left
                        : index === selectedCells()!.top)
                        ? "true"
                        : undefined
                    }
                    data-active={
                      drag()?.axis === axis && drag()?.index === index ? "true" : undefined
                    }
                    style={
                      axis === "column"
                        ? {
                            left: `${rect().left - measured().wrapper.left}px`,
                            top: `${measured().table.top - measured().wrapper.top - HANDLE_SPACE}px`,
                            width: `${rect().width}px`,
                            height: `${HANDLE_SPACE}px`
                          }
                        : {
                            left: `${measured().table.left - measured().wrapper.left - HANDLE_SPACE}px`,
                            top: `${rect().top - measured().wrapper.top}px`,
                            width: `${HANDLE_SPACE}px`,
                            height: `${rect().height}px`
                          }
                    }
                  >
                    <span
                      data-table-grip-marker
                      class={clsx(
                        "absolute bg-gray-400 border-gray-50 pointer-events-none",
                        axis === "column"
                          ? "w-4 h-px border-x-2 -bottom-[0.5px] translate-y-1/2"
                          : "h-4 w-px border-y-2 -right-[0.5px] translate-x-1/2"
                      )}
                    />
                    <IconButton
                      variant="outlined"
                      color="contrast"
                      size="xs"
                      text="soft"
                      icon={
                        axis === "column" ? "i-lucide:grip-horizontal" : "i-lucide:grip-vertical"
                      }
                      iconProps={{ style: { width: "12px", height: "12px" } }}
                      aria-label={`Select ${axis} ${index + 1} and open cell actions`}
                      title={`Click for ${axis} actions. Drag to move it.`}
                      class="rounded-[0.25rem] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 cursor-grab active:cursor-grabbing touch-none"
                      style={
                        axis === "column"
                          ? { width: "24px", height: "12px", padding: "0" }
                          : { width: "12px", height: "24px", padding: "0" }
                      }
                      onPointerDown={(event) => startDrag(event, axis, index)}
                      onLostPointerCapture={stopDrag}
                      onKeyDown={(event) => moveWithKeyboard(event, axis, index)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.detail === 0) {
                          const rect = event.currentTarget.getBoundingClientRect();

                          selectCells(axis, index, { x: rect.right, y: rect.bottom });
                        }
                      }}
                    />
                  </div>
                )}
              </Index>
            )}
          </For>
          <Show when={drag()?.active && drag()}>
            {(current) => {
              const position = () => {
                const rects = current().axis === "column" ? measured().columns : measured().rows;
                const rect = rects[current().boundary] || rects[rects.length - 1];

                return current().axis === "column"
                  ? (current().boundary < rects.length ? rect.left : rect.right) -
                      measured().wrapper.left
                  : (current().boundary < rects.length ? rect.top : rect.bottom) -
                      measured().wrapper.top;
              };

              return (
                <div
                  class="absolute pointer-events-none"
                  data-table-indicator={current().axis}
                  style={
                    current().axis === "column"
                      ? {
                          left: `${position() + INDICATOR_CENTERING_OFFSET}px`,
                          top: `${measured().table.top - measured().wrapper.top}px`,
                          width: "2px",
                          height: `${measured().table.height - INDICATOR_SIDE_SPACING * 2}px`
                        }
                      : {
                          left: `${measured().table.left - measured().wrapper.left}px`,
                          top: `${position() + INDICATOR_CENTERING_OFFSET}px`,
                          height: "2px",
                          width: `${measured().table.width - INDICATOR_SIDE_SPACING * 2}px`
                        }
                  }
                />
              );
            }}
          </Show>
          <TableResizeControls
            {...props}
            layout={layout}
            enabled={() => canEdit() && !drag() && !extending() && !selectingCells()}
            measure={measure}
            setResizing={setResizing}
          />
          <TableCellMenu
            {...props}
            layout={layout}
            enabled={() => canEdit() && !drag() && !resizing() && !extending() && !selectingCells()}
            anchor={menuAnchor}
            setAnchor={setMenuAnchor}
          />
          <TableExtensionControls
            {...props}
            layout={layout}
            enabled={() => canEdit() && !drag() && !resizing() && !selectingCells()}
            setExtending={setExtending}
          />
        </>
      )}
    </Show>
  );
};

export { TableControls };
