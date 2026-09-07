import type { TableDrag } from "./types";

const getTableEdgeScrollSpeed = (
  coordinate: number,
  start: number,
  end: number,
  pointerType: string
): number => {
  const touch = pointerType === "touch";
  const edge = Math.min(touch ? 48 : 40, (end - start) / 2);
  const direction = coordinate < start + edge ? -1 : coordinate > end - edge ? 1 : 0;
  const distance = direction < 0 ? start + edge - coordinate : coordinate - end + edge;

  if (!direction || edge <= 0) return 0;

  // A slower, gradual ramp makes touch drags easier to control near an edge.
  return direction * (touch ? 6 * Math.min(1, distance / edge) ** 2 : Math.min(18, distance / 3));
};

const scrollTableDrag = (
  current: TableDrag,
  horizontalContainer: HTMLElement,
  horizontalRect: DOMRect,
  verticalContainer: HTMLElement,
  verticalRect: DOMRect
): void => {
  if (current.pointerType !== "touch" || current.axis === "column") {
    horizontalContainer.scrollLeft += getTableEdgeScrollSpeed(
      current.x,
      horizontalRect.left,
      horizontalRect.right,
      current.pointerType
    );
  }

  if (current.pointerType !== "touch" || current.axis === "row") {
    verticalContainer.scrollTop += getTableEdgeScrollSpeed(
      current.y,
      verticalRect.top,
      verticalRect.bottom,
      current.pointerType
    );
  }
};

export { getTableEdgeScrollSpeed, scrollTableDrag };
