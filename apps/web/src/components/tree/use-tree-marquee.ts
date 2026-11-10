import { createRef } from "@andesine/components";
import { createSignal, onCleanup, onMount } from "solid-js";
import { useTree } from "./tree-context";

interface TreeMarqueeSelection {
  active: boolean;
  currentX: number;
  currentY: number;
  height: number;
  width: number;
  x: number;
  y: number;
}

type TreeMarqueeMode = "add" | "remove" | "replace";

const createEmptySelection = (): TreeMarqueeSelection => ({
  active: false,
  currentX: 0,
  currentY: 0,
  height: 0,
  width: 0,
  x: 0,
  y: 0
});

const useTreeMarquee = (
  container: () => HTMLElement | null,
  contentContainer: () => HTMLElement | null,
  getSelectionGroup?: (id: string) => string | null
) => {
  const [{ selection, flattenedLayout }, { setExactSelection }] = useTree();
  const [pointerDown, setPointerDown] = createSignal(false);
  const [boxSelection, setBoxSelection] = createSignal(createEmptySelection());
  const [initialSelection, setInitialSelection] = createRef<string[]>([]);
  const [mode, setMode] = createRef<TreeMarqueeMode>("replace");
  const [selectionGroup, setSelectionGroup] = createRef<string | null>(null);
  const [scrollFrame, setScrollFrame] = createRef(0);
  const [containerRect, setContainerRect] = createRef<DOMRect | null>(null);
  const [contentOffsetTop, setContentOffsetTop] = createRef(0);
  const getContainerRect = () => {
    const cachedRect = containerRect();

    if (cachedRect) return cachedRect;

    const element = container();

    if (!element) return null;

    const rect = element.getBoundingClientRect();

    setContainerRect(rect);

    return rect;
  };
  const clampToContainer = (x: number, y: number) => {
    const rect = getContainerRect();

    if (!rect) return { x, y };

    return {
      x: Math.min(rect.right, Math.max(rect.left, x)),
      y: Math.min(rect.bottom, Math.max(rect.top, y))
    };
  };
  const stopAutoScroll = () => {
    window.cancelAnimationFrame(scrollFrame());
    setScrollFrame(0);
  };
  const applySelection = (box = boxSelection()) => {
    const element = container();
    const rect = getContainerRect();

    if (!element || !rect || !box.active) return;

    const left = Math.min(box.x, box.currentX);
    const right = Math.max(box.x, box.currentX);
    const top = Math.min(box.y, box.currentY);
    const bottom = Math.max(box.y, box.currentY);
    const intersected = flattenedLayout().flatMap((item) => {
      const itemTop = rect.top + contentOffsetTop() + item.top - element.scrollTop;
      const intersects =
        rect.left < right && itemTop < bottom && rect.right > left && itemTop + item.height > top;

      return intersects ? [item.id] : [];
    });
    const firstIntersected =
      box.currentY >= box.y ? intersected[0] : intersected[intersected.length - 1];

    if (intersected.length === 0) {
      setSelectionGroup(null);
    } else if (!selectionGroup() && firstIntersected) {
      setSelectionGroup(getSelectionGroup?.(firstIntersected) ?? null);
    }

    const currentSelectionGroup = selectionGroup();
    const selected = currentSelectionGroup
      ? intersected.filter((id) => getSelectionGroup?.(id) === currentSelectionGroup)
      : intersected;

    if (mode() === "add") {
      setExactSelection(Array.from(new Set([...initialSelection(), ...selected])));
    } else if (mode() === "remove") {
      const selectedSet = new Set(selected);

      setExactSelection(initialSelection().filter((id) => !selectedSet.has(id)));
    } else {
      setExactSelection(selected);
    }
  };
  const startAutoScroll = () => {
    stopAutoScroll();

    const scroll = () => {
      const element = container();
      const box = boxSelection();

      if (!element || !pointerDown() || !box.active) return stopAutoScroll();

      const rect = getContainerRect();

      if (!rect) return stopAutoScroll();

      const threshold = 36;
      const speed =
        box.currentY < rect.top + threshold
          ? Math.max(-12, (box.currentY - rect.top - threshold) / 3)
          : box.currentY > rect.bottom - threshold
            ? Math.min(12, (box.currentY - rect.bottom + threshold) / 3)
            : 0;
      const previous = element.scrollTop;

      element.scrollTop += speed;
      if (element.scrollTop !== previous) applySelection(box);
      setScrollFrame(window.requestAnimationFrame(scroll));
    };

    setScrollFrame(window.requestAnimationFrame(scroll));
  };
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target;

    if (!(target instanceof Element) || event.button !== 0) return;
    if (
      !target.closest("[data-tree-marquee]") ||
      target.closest("[data-tree-interaction], [data-tree-item]")
    ) {
      return;
    }

    const point = clampToContainer(event.clientX, event.clientY);
    const element = container();
    const contentElement = contentContainer();
    const rect = getContainerRect();

    if (element && contentElement && rect) {
      const contentRect = contentElement.getBoundingClientRect();

      setContentOffsetTop(contentRect.top - rect.top + element.scrollTop);
    }

    setInitialSelection(selection());
    setSelectionGroup(null);
    setMode(
      event.altKey ? "remove" : event.metaKey || event.ctrlKey || event.shiftKey ? "add" : "replace"
    );
    setPointerDown(true);
    setBoxSelection({
      ...createEmptySelection(),
      currentX: point.x,
      currentY: point.y,
      x: point.x,
      y: point.y
    });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!pointerDown()) return;

    const previous = boxSelection();
    const point = clampToContainer(event.clientX, event.clientY);
    const width = Math.abs(point.x - previous.x);
    const height = Math.abs(point.y - previous.y);
    const next = {
      ...previous,
      active: previous.active || width > 10 || height > 10,
      currentX: point.x,
      currentY: point.y,
      height,
      width
    };

    setBoxSelection(next);
    if (!next.active) return;
    applySelection(next);
    if (!previous.active) startAutoScroll();
  };
  const onPointerEnd = () => {
    setPointerDown(false);
    setContainerRect(null);
    setContentOffsetTop(0);
    setSelectionGroup(null);
    stopAutoScroll();
    setBoxSelection(createEmptySelection());
  };

  onMount(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("blur", onPointerEnd);
    document.body.addEventListener("pointerleave", onPointerEnd);
    document.body.addEventListener("contextmenu", onPointerEnd);
    onCleanup(() => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("blur", onPointerEnd);
      document.body.removeEventListener("pointerleave", onPointerEnd);
      document.body.removeEventListener("contextmenu", onPointerEnd);
      onPointerEnd();
    });
  });

  return { boxSelection, onPointerDown };
};

export { useTreeMarquee };
