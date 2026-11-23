const BLOCK_SCROLLERS = "[data-table-scroll-container], .cm-scroller";

const getBlockScroller = (block: HTMLElement): HTMLElement | null => {
  return block.querySelector<HTMLElement>(BLOCK_SCROLLERS);
};
const isScrolledToEnd = (scroller: HTMLElement): boolean => {
  return scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 1;
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

  return !scroller || isScrolledToEnd(scroller);
};
/** How far a block has left to scroll, which it reaches past the content's edge. */
const getBlockReach = (element: Element, block: boolean): number => {
  const scroller = block
    ? element.querySelector<HTMLElement>(BLOCK_SCROLLERS)
    : element.closest<HTMLElement>(BLOCK_SCROLLERS);

  return scroller && !isScrolledToEnd(scroller)
    ? scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft
    : 0;
};
const getBlockScrollers = (root: HTMLElement): HTMLElement[] => {
  return [...root.querySelectorAll<HTMLElement>(BLOCK_SCROLLERS)];
};

export {
  getBlockReach,
  getBlockScrollers,
  isBlockAtScrollEnd,
  isBlockAtScrollStart,
  isBlockScrollable
};
