import { getTableEdgeScrollSpeed } from "./edge-scroll";
import { getCachedElementRect } from "#editor/ui/block-control-sizing";
import { IconButton } from "@andesine/components";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  type Accessor,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  untrack
} from "solid-js";
import clsx from "clsx";
import { appendTableItems } from "./append";
import { DEFAULT_COLUMN_WIDTH } from "./columns";
import { TableExtensionPreview } from "./extension-preview";
import type { TableAxis, TableControlsProps, TableLayout } from "./types";

interface TableExtensionControlsProps extends TableControlsProps {
  layout: Accessor<TableLayout | null>;
  enabled: Accessor<boolean>;
  setExtending(value: boolean): void;
}
interface TableExtension {
  axis: TableAxis;
  node: ProseMirrorNode;
  target: HTMLElement;
  pointerID: number;
  pointerType: string;
  startX: number;
  startY: number;
  startScrollX: number;
  startScrollY: number;
  x: number;
  y: number;
  count: number;
  dragged: boolean;
  rowHeight: number;
  widths: number[];
}

const EXTENSION_SPACE = 24;
const HOVER_INSET = 5;
const TableExtensionControls = (props: TableExtensionControlsProps) => {
  const [extension, setExtension] = createSignal<TableExtension | null>(null);
  const getContainer = (axis: TableAxis) =>
    props.view.dom.closest<HTMLElement>(
      axis === "column" ? "[data-table-scroll-container]" : "[data-editor-scrollable-container]"
    );
  const widths = () =>
    props
      .layout()
      ?.columns.map((column) => Math.max(DEFAULT_COLUMN_WIDTH, Math.round(column.width))) || [];
  const extraWidth = () =>
    extension()?.axis === "column" ? extension()!.count * DEFAULT_COLUMN_WIDTH : 0;
  const extraHeight = () =>
    extension()?.axis === "row" ? extension()!.count * extension()!.rowHeight : 0;

  let scrollFrame: number | null = null;

  const getRowHeight = () => {
    const emptyRow = Array.from(props.view.table.rows).find((row) =>
      Array.from(row.cells).every((cell) => !cell.textContent?.trim())
    );
    const cell = props.view.table.rows[0]?.cells[0];
    const paragraph = cell?.querySelector("p");

    if (emptyRow) return getCachedElementRect(props.editor, emptyRow).height;

    if (!cell || !paragraph) return 40;

    const cellStyle = getComputedStyle(cell);
    const paragraphStyle = getComputedStyle(paragraph);
    const lineHeight =
      parseFloat(paragraphStyle.lineHeight) || parseFloat(paragraphStyle.fontSize) * 1.5;

    return Math.ceil(
      lineHeight +
        parseFloat(cellStyle.paddingTop) +
        parseFloat(cellStyle.paddingBottom) +
        parseFloat(cellStyle.borderBottomWidth)
    );
  };
  const stop = () => {
    const current = extension();

    setExtension(null);
    props.setExtending(false);
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    if (current?.target.hasPointerCapture(current.pointerID)) {
      current.target.releasePointerCapture(current.pointerID);
    }
  };
  const append = (axis: TableAxis, count: number, columnWidths: number[]) => {
    const pos = props.getPos();

    if (!props.enabled() || typeof pos !== "number" || count < 1) return;

    appendTableItems(props.editor, pos, axis, count, columnWidths);
  };
  const preview = (x: number, y: number) => {
    const current = extension();
    const horizontalContainer = getContainer("column");
    const verticalContainer = getContainer("row");

    if (!current) return;

    const dx = x - current.startX + (horizontalContainer?.scrollLeft || 0) - current.startScrollX;
    const dy = y - current.startY + (verticalContainer?.scrollTop || 0) - current.startScrollY;
    const offset = current.axis === "column" ? dx : dy;
    const step = current.axis === "column" ? DEFAULT_COLUMN_WIDTH : current.rowHeight;

    setExtension({
      ...current,
      x,
      y,
      count: Math.max(0, Math.floor(offset / step)),
      dragged: current.dragged || Math.hypot(dx, dy) >= 4
    });
  };
  const autoScroll = () => {
    const current = extension();
    const container = current ? getContainer(current.axis) : null;

    scrollFrame = null;
    if (!current || !container) return;

    const rect = getCachedElementRect(props.editor, container);
    const coordinate = current.axis === "column" ? current.x : current.y;
    const start = current.axis === "column" ? rect.left : rect.top;
    const end = current.axis === "column" ? rect.right : rect.bottom;
    const speed = getTableEdgeScrollSpeed(coordinate, start, end, current.pointerType);

    if (current.dragged && speed) {
      if (current.axis === "column") container.scrollLeft += speed;
      else container.scrollTop += speed;
      preview(current.x, current.y);
    }

    scrollFrame = requestAnimationFrame(autoScroll);
  };
  const start = (event: PointerEvent, axis: TableAxis) => {
    if (event.button !== 0 || !props.enabled() || extension()) return;

    const target = event.currentTarget as HTMLElement;
    const horizontalContainer = getContainer("column");
    const verticalContainer = getContainer("row");

    event.preventDefault();
    event.stopPropagation();
    target.setPointerCapture(event.pointerId);
    setExtension({
      axis,
      node: props.node(),
      target,
      pointerID: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startScrollX: horizontalContainer?.scrollLeft || 0,
      startScrollY: verticalContainer?.scrollTop || 0,
      x: event.clientX,
      y: event.clientY,
      count: 0,
      dragged: false,
      rowHeight: getRowHeight(),
      widths: widths()
    });
    props.setExtending(true);
    scrollFrame = requestAnimationFrame(autoScroll);
  };
  const movePointer = (event: PointerEvent) => {
    if (extension()?.pointerID !== event.pointerId) return;

    event.preventDefault();
    preview(event.clientX, event.clientY);
  };
  const finish = (event: PointerEvent) => {
    if (extension()?.pointerID !== event.pointerId) return;

    preview(event.clientX, event.clientY);

    const current = extension()!;

    if (current.node === props.node()) {
      append(current.axis, current.dragged ? current.count : 1, current.widths);
    }

    stop();
  };
  const cancelKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !extension()) return;

    event.preventDefault();
    event.stopPropagation();
    stop();
  };

  createEffect(() => {
    props.view.dom.style.setProperty("--table-preview-height", `${extraHeight()}px`);
    props.view.dom.style.setProperty("--table-preview-width", `${extraWidth()}px`);
  });
  createEffect(() => {
    const node = props.node();
    const enabled = props.enabled();
    const current = untrack(extension);

    if (current && (current.node !== node || !enabled)) untrack(stop);
  });
  onMount(() => {
    window.addEventListener("pointermove", movePointer, { passive: false });
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop);
    window.addEventListener("keydown", cancelKey, true);
    onCleanup(() => {
      stop();
      props.view.dom.style.removeProperty("--table-preview-height");
      props.view.dom.style.removeProperty("--table-preview-width");
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", finish, true);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
      window.removeEventListener("keydown", cancelKey, true);
    });
  });

  return (
    <Show when={props.layout()}>
      {(layout) => (
        <>
          <Show when={extension()?.count}>
            <TableExtensionPreview
              node={props.node()}
              layout={layout()}
              axis={extension()!.axis}
              count={extension()!.count}
              rowHeight={extension()!.rowHeight}
            />
          </Show>
          <For each={["column", "row"] as const}>
            {(axis) => (
              <div
                data-table-extension-handle={axis}
                data-active={extension()?.axis === axis ? "true" : undefined}
                class="group absolute z-30"
                style={
                  axis === "column"
                    ? {
                        "left": `${layout().table.right - layout().wrapper.left + extraWidth() + HOVER_INSET}px`,
                        "top": `${layout().table.top - layout().wrapper.top}px`,
                        "width": `${EXTENSION_SPACE - HOVER_INSET}px`,
                        "height": `${layout().table.height + extraHeight()}px`,
                        "pointer-events": props.enabled() ? "auto" : "none"
                      }
                    : {
                        "left": `${layout().table.left - layout().wrapper.left}px`,
                        "top": `${layout().table.bottom - layout().wrapper.top + extraHeight() + HOVER_INSET}px`,
                        "height": `${EXTENSION_SPACE - HOVER_INSET}px`,
                        "width": `${layout().table.width + extraWidth()}px`,
                        "pointer-events": props.enabled() ? "auto" : "none"
                      }
                }
              >
                <IconButton
                  variant="outlined"
                  color="contrast"
                  size="xs"
                  text="soft"
                  icon="i-lucide:plus"
                  iconProps={{ style: { width: "12px", height: "12px" } }}
                  aria-label={axis === "column" ? "Add columns" : "Add rows"}
                  title={extension() ? undefined : `Click to add one ${axis}, or drag to add more`}
                  tabIndex={props.enabled() ? 0 : -1}
                  class={clsx(
                    "rounded-[0.25rem] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 touch-none",
                    axis === "column" ? "cursor-ew-resize" : "cursor-ns-resize"
                  )}
                  style={
                    axis === "column"
                      ? {
                          position: "absolute",
                          left: "1px",
                          top: "0",
                          width: "12px",
                          height: "100%",
                          padding: "0"
                        }
                      : {
                          position: "absolute",
                          top: "1px",
                          left: "0",
                          height: "12px",
                          width: "100%",
                          padding: "0"
                        }
                  }
                  onPointerDown={(event) => start(event, axis)}
                  onLostPointerCapture={stop}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.detail === 0) append(axis, 1, widths());
                  }}
                />
              </div>
            )}
          </For>
        </>
      )}
    </Show>
  );
};

export { TableExtensionControls };
