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
/** The width of a table without set column widths, which fits without scrolling. */
const getTableContentWidth = (element: HTMLElement): number => {
  const content = getTableNodeView(element)?.querySelector<HTMLElement>("[data-table-content]");

  return parseFloat(content?.style.getPropertyValue("--table-content-width") ?? "") || 0;
};

export { getTableContentWidth, getTableElement, getTableScrollContainer };
