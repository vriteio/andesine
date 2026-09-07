import type { Editor } from "@tiptap/core";
import {
  getCachedElementRect,
  invalidateBlockControlLayout
} from "#editor/ui/block-control-sizing";
import type { TableView } from "@tiptap/extension-table";

const createTableViewport = (editor: Editor, view: TableView, onLayout: () => void) => {
  const dom = document.createElement("div");
  const viewport = document.createElement("div");
  const shadows = document.createElement("div");
  const observer = new ResizeObserver(() => {
    invalidateBlockControlLayout(editor);
    scheduleLayout();
  });

  let frame: number | null = null;
  let initialized = false;

  const updateLayout = () => {
    const container = dom.closest<HTMLElement>("[data-editor-scrollable-container]");

    frame = null;
    if (!dom.isConnected || !container) return;

    const rect = getCachedElementRect(editor, dom);
    const containerRect = getCachedElementRect(editor, container);
    const inset = rect.left - containerRect.left - container.clientLeft;
    const width = container.clientWidth;
    const contentWidth = dom.clientWidth;
    const height = viewport.clientHeight;
    const scrollStart = Math.max(0, 24 - inset);
    const atStart = viewport.scrollLeft <= Number(viewport.dataset.tableScrollStart || 0) + 1;

    viewport.style.width = `${width}px`;
    viewport.style.marginLeft = `${-inset}px`;
    shadows.style.left = `${-inset}px`;
    shadows.style.width = `${width}px`;
    shadows.style.height = `${height}px`;
    view.dom.style.setProperty("--table-content-width", `${contentWidth}px`);
    view.dom.style.setProperty("--table-left-space", `${Math.max(24, inset)}px`);

    viewport.dataset.tableScrollStart = String(scrollStart);
    if (!initialized || atStart) viewport.scrollLeft = scrollStart;

    if (!initialized) {
      observer.observe(container);
      initialized = true;
    }

    onLayout();
  };
  const scheduleLayout = () => {
    if (frame === null) frame = requestAnimationFrame(updateLayout);
  };

  dom.setAttribute("data-table-node-view", "");
  viewport.setAttribute("data-table-scroll-container", "");
  shadows.className = "absolute top-0 pointer-events-none z-20";
  shadows.contentEditable = "false";
  view.dom.setAttribute("data-table-content", "");
  viewport.appendChild(view.dom);
  dom.appendChild(viewport);
  dom.appendChild(shadows);
  observer.observe(dom);
  observer.observe(view.dom);
  observer.observe(view.table);
  window.addEventListener("resize", scheduleLayout);
  scheduleLayout();

  return {
    dom,
    shadows,
    scrollContainer: viewport,
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", scheduleLayout);
      if (frame !== null) cancelAnimationFrame(frame);
    }
  };
};

export { createTableViewport };
