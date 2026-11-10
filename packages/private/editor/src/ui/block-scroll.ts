const getBlockScroller = (block: HTMLElement): HTMLElement | null => {
  return block.querySelector<HTMLElement>("[data-table-scroll-container], .cm-scroller");
};
const isBlockScrollable = (block: HTMLElement): boolean => {
  const scroller = getBlockScroller(block);

  return Boolean(scroller && scroller.scrollWidth > scroller.clientWidth);
};
const isBlockAtScrollStart = (block: HTMLElement): boolean => {
  const scroller = getBlockScroller(block);

  if (!scroller || !isBlockScrollable(block)) return true;

  const { codeScrollStart, tableScrollStart } = scroller.dataset;

  return scroller.scrollLeft <= Number(tableScrollStart ?? codeScrollStart ?? 0) + 1;
};
const isBlockAtScrollEnd = (block: HTMLElement): boolean => {
  const scroller = getBlockScroller(block);

  if (!scroller || !isBlockScrollable(block)) return true;

  return scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 1;
};

export { isBlockAtScrollEnd, isBlockAtScrollStart, isBlockScrollable };
