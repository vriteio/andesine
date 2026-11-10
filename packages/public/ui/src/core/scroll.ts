/** Returns the document's `scroll-padding-top` in pixels, the height of sticky headers. */
const getScrollOffset = (): number => {
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
};

/** Scrolls a container just enough to show an element, with a margin at the edges. */
const scrollIntoContainer = (container: HTMLElement, element: Element, margin = 8): void => {
  const bounds = container.getBoundingClientRect();
  const target = element.getBoundingClientRect();

  if (target.top < bounds.top + margin) {
    container.scrollTop += target.top - bounds.top - margin;
  }

  if (target.bottom > bounds.bottom - margin) {
    container.scrollTop += target.bottom - bounds.bottom + margin;
  }
};

export { getScrollOffset, scrollIntoContainer };
