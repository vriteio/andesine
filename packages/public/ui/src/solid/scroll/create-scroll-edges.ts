import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

interface ScrollEdges {
  /** The page is scrolled away from its top. */
  start: Accessor<boolean>;
  /** More of the page is below the viewport. */
  end: Accessor<boolean>;
}

/** Tracks whether the page has content past the top and bottom of the viewport, e.g. for fades. */
const createScrollEdges = (): ScrollEdges => {
  const [start, setStart] = createSignal(false);
  const [end, setEnd] = createSignal(false);

  onMount(() => {
    const root = document.documentElement;
    const update = (): void => {
      setStart(root.scrollTop > 0);
      setEnd(root.scrollHeight - root.clientHeight - root.scrollTop >= 10);
    };
    const observer = new ResizeObserver(update);

    observer.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    update();
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    });
  });

  return { start, end };
};

export { createScrollEdges };
export type { ScrollEdges };
