import { getTableEdgeScrollSpeed } from "./edge-scroll";
import {
  getCachedElementRect,
  invalidateBlockControlLayout
} from "#editor/ui/block-control-sizing";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { DEFAULT_COLUMN_WIDTH, setTableColumnWidths } from "./columns";
import {
  type Accessor,
  createEffect,
  createSignal,
  Index,
  onCleanup,
  onMount,
  untrack
} from "solid-js";
import type { TableControlsProps, TableLayout } from "./types";

interface TableResizeControlsProps extends TableControlsProps {
  layout: Accessor<TableLayout | null>;
  enabled: Accessor<boolean>;
  measure(): void;
  setResizing(value: boolean): void;
}
interface ColumnResize {
  column: number;
  pointerID: number;
  pointerType: string;
  target: HTMLElement;
  node: ProseMirrorNode;
  widths: number[];
  startX: number;
  startScroll: number;
  x: number;
  width: number;
}

const TableResizeControls = (props: TableResizeControlsProps) => {
  const [hovered, setHovered] = createSignal<number | null>(null);
  const [resize, setResize] = createSignal<ColumnResize | null>(null);
  const getContainer = () => props.view.dom.closest<HTMLElement>("[data-table-scroll-container]");
  const getWidths = () =>
    props
      .layout()
      ?.columns.map((column) => Math.max(DEFAULT_COLUMN_WIDTH, Math.round(column.width))) || [];

  let scrollFrame: number | null = null;

  const restoreWidths = () => {
    for (const column of Array.from(props.view.colgroup.children)) {
      (column as HTMLElement).style.removeProperty("width");
      (column as HTMLElement).style.removeProperty("min-width");
    }

    props.view.update(props.node());
    invalidateBlockControlLayout(props.editor);
    props.measure();
  };
  const stop = (restore = true) => {
    const current = resize();

    setResize(null);
    setHovered(null);
    props.setResizing(false);
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    if (current?.target.hasPointerCapture(current.pointerID)) {
      current.target.releasePointerCapture(current.pointerID);
    }

    if (restore && current) restoreWidths();
  };
  const saveWidths = (widths: number[]) => {
    const pos = props.getPos();
    const tr = props.editor.state.tr;

    if (!props.enabled() || typeof pos !== "number") return;

    setTableColumnWidths(tr, pos, widths);

    if (tr.docChanged) props.editor.view.dispatch(tr);
  };
  const preview = (x: number) => {
    const current = resize();

    if (!current) return;

    const scroll = getContainer()?.scrollLeft || 0;
    const width = Math.max(
      DEFAULT_COLUMN_WIDTH,
      Math.round(current.widths[current.column] + x - current.startX + scroll - current.startScroll)
    );
    if (width === current.width) return;

    const widths = current.widths.map((value, index) => (index === current.column ? width : value));

    Array.from(props.view.colgroup.children).forEach((column, index) => {
      (column as HTMLElement).style.width = `${widths[index]}px`;
    });
    props.view.table.style.width = `${widths.reduce((sum, value) => sum + value, 0)}px`;
    props.view.table.style.minWidth = "";
    setResize({ ...current, x, width });
    invalidateBlockControlLayout(props.editor);
    props.measure();
  };
  const autoScroll = () => {
    const current = resize();
    const container = getContainer();

    scrollFrame = null;
    if (!current || !container) return;

    const rect = getCachedElementRect(props.editor, container);
    const touchStarted =
      current.pointerType !== "touch" ||
      Math.abs(current.x - current.startX) >= 4 ||
      current.width !== current.widths[current.column];
    const speed = touchStarted
      ? getTableEdgeScrollSpeed(current.x, rect.left, rect.right, current.pointerType)
      : 0;

    if (speed) container.scrollLeft += speed;
    preview(current.x);

    scrollFrame = requestAnimationFrame(autoScroll);
  };
  const start = (event: PointerEvent, column: number) => {
    if (event.button !== 0 || !props.enabled()) return;

    const widths = getWidths();
    const target = event.currentTarget as HTMLElement;

    event.preventDefault();
    event.stopPropagation();
    target.setPointerCapture(event.pointerId);
    setResize({
      column,
      pointerID: event.pointerId,
      pointerType: event.pointerType,
      target,
      node: props.node(),
      widths,
      startX: event.clientX,
      startScroll: getContainer()?.scrollLeft || 0,
      x: event.clientX,
      width: widths[column]
    });
    props.setResizing(true);
    scrollFrame = requestAnimationFrame(autoScroll);
  };
  const movePointer = (event: PointerEvent) => {
    if (resize()?.pointerID !== event.pointerId) return;

    event.preventDefault();
    setResize((current) => current && { ...current, x: event.clientX });
  };
  const finish = (event: PointerEvent) => {
    if (resize()?.pointerID !== event.pointerId) return;

    preview(event.clientX);

    const current = resize()!;
    const widths = current.widths.map((width, index) =>
      index === current.column ? current.width : width
    );

    stop(false);
    if (current.node === props.node() && current.width !== current.widths[current.column]) {
      saveWidths(widths);
    }

    restoreWidths();
  };
  const cancel = () => stop();
  const cancelKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !resize()) return;

    event.preventDefault();
    event.stopPropagation();
    stop();
  };
  const resizeWithKeyboard = (event: KeyboardEvent, column: number) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !props.enabled()) return;

    const widths = getWidths();
    const step = event.shiftKey ? 1 : 10;

    event.preventDefault();
    event.stopPropagation();
    widths[column] = Math.max(
      DEFAULT_COLUMN_WIDTH,
      widths[column] + (event.key === "ArrowRight" ? step : -step)
    );
    saveWidths(widths);
  };

  createEffect(() => {
    const node = props.node();
    const enabled = props.enabled();
    const current = untrack(resize);

    if (current && (node !== current.node || !enabled)) untrack(stop);
  });
  onMount(() => {
    window.addEventListener("pointermove", movePointer, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", cancelKey, true);
    onCleanup(() => {
      stop(false);
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", cancelKey, true);
    });
  });

  return (
    <Index each={props.layout()?.columns}>
      {(column, index) => (
        <div
          data-table-resize-handle
          role="separator"
          aria-label={`Resize column ${index + 1}`}
          aria-orientation="vertical"
          aria-valuemin={DEFAULT_COLUMN_WIDTH}
          aria-valuenow={Math.round(column().width)}
          tabIndex={props.enabled() ? 0 : -1}
          class="absolute z-20 cursor-col-resize touch-none outline-none"
          style={{
            "left": `${column().right - (props.layout()?.wrapper.left || 0) - 4.5}px`,
            "top": `${(props.layout()?.table.top || 0) - (props.layout()?.wrapper.top || 0)}px`,
            "width": "10px",
            "height": `${props.layout()?.table.height || 0}px`,
            "pointer-events": props.enabled() ? "auto" : "none"
          }}
          onPointerEnter={() => setHovered(index)}
          onPointerLeave={() => setHovered(null)}
          onFocus={() => setHovered(index)}
          onBlur={() => setHovered(null)}
          onPointerDown={(event) => start(event, index)}
          onKeyDown={(event) => resizeWithKeyboard(event, index)}
          onLostPointerCapture={cancel}
        >
          <span
            data-table-indicator="column"
            class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 pointer-events-none"
            style={{
              opacity:
                props.enabled() &&
                (resize()?.column === index || (!resize() && hovered() === index))
                  ? 1
                  : 0
            }}
          />
        </div>
      )}
    </Index>
  );
};

export { TableResizeControls };
