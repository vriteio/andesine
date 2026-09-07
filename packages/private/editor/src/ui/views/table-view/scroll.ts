import type { Editor } from "@tiptap/core";
import { getCachedElementRect } from "#editor/ui/block-control-sizing";

const getTableNodeView = (element: HTMLElement): HTMLElement | null => {
  return element.matches("[data-table-node-view]")
    ? element
    : element.closest<HTMLElement>("[data-table-node-view]");
};
const getTableElement = (element: HTMLElement): HTMLTableElement | null => {
  return getTableNodeView(element)?.querySelector("table") || null;
};
const getTableScrollContainer = (element: HTMLElement): HTMLElement | null => {
  const table = getTableNodeView(element);

  return table?.querySelector<HTMLElement>("[data-table-scroll-container]") || null;
};
const getTableContentWidth = (element: HTMLElement): number => {
  return getTableNodeView(element)?.clientWidth || 0;
};

const doesTableExtendPastContent = (editor: Editor, element: HTMLElement): boolean => {
  const table = getTableElement(element);
  const tableNodeView = getTableNodeView(element);

  return Boolean(
    table && tableNodeView && getCachedElementRect(editor, table).width > tableNodeView.clientWidth
  );
};

const isTableAtScrollStart = (element: HTMLElement): boolean => {
  const container = getTableScrollContainer(element);

  if (!container || container.scrollWidth <= container.clientWidth) return true;

  const start = Number.parseFloat(container.dataset.tableScrollStart || "0");

  return container.scrollLeft <= start + 1;
};

export {
  doesTableExtendPastContent,
  getTableContentWidth,
  getTableElement,
  getTableScrollContainer,
  isTableAtScrollStart
};
