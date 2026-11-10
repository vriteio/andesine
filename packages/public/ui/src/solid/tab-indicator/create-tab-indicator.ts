import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

interface TabIndicatorOptions {
  /** Index of the current tab, or -1. */
  current: Accessor<number>;
}

interface TabIndicator {
  position: Accessor<TabIndicatorPosition | undefined>;
  /** The positioned wrapper of the indicator; it does not scroll. */
  rootRef(element: HTMLElement): void;
  scrollRef(element: HTMLElement): void;
  tabRef(index: number, element: HTMLElement): void;
}

interface TabIndicatorPosition {
  left: number;
  width: number;
}

/** Measures an underline for the current tab of a scrollable row, and keeps that tab in view. */
const createTabIndicator = (options: TabIndicatorOptions): TabIndicator => {
  const [position, setPosition] = createSignal<TabIndicatorPosition>();
  const tabs = new Map<number, HTMLElement>();

  let root: HTMLElement | undefined;
  let scroll: HTMLElement | undefined;

  onMount(() => {
    let frame = 0;

    const measure = (): void => {
      const rootBounds = root?.getBoundingClientRect();
      const tabBounds = tabs.get(options.current())?.getBoundingClientRect();

      frame = 0;
      setPosition(
        rootBounds &&
          tabBounds && { left: tabBounds.left - rootBounds.left, width: tabBounds.width }
      );
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);

    tabs.get(options.current())?.scrollIntoView({ block: "nearest", inline: "nearest" });

    if (root) observer.observe(root);

    scroll?.addEventListener("scroll", schedule, { passive: true });
    schedule();
    onCleanup(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroll?.removeEventListener("scroll", schedule);
    });
  });

  return {
    position,
    rootRef: (element) => (root = element),
    scrollRef: (element) => (scroll = element),
    tabRef: (index, element) => tabs.set(index, element)
  };
};

export { createTabIndicator };
export type { TabIndicatorOptions, TabIndicatorPosition, TabIndicator };
