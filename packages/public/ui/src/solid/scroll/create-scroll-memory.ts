import { onCleanup, onMount } from "solid-js";
import { scrollIntoContainer } from "../../core/scroll";
import { readSession, writeSession } from "../../core/storage";

interface ScrollMemoryOptions {
  container: () => HTMLElement | undefined;
  /** Session storage key of the scroll position. */
  key: string;
  /** Kept in view after the position is restored. */
  current?: () => Element | null | undefined;
}

/** Keeps the scroll position of a container between pages, and shows the current item. */
const createScrollMemory = (options: ScrollMemoryOptions): void => {
  onMount(() => {
    const container = options.container();
    const current = options.current?.();

    if (!container) return;

    const save = (): void => writeSession(options.key, container.scrollTop);

    container.scrollTop = Number(readSession(options.key)) || 0;

    if (current) scrollIntoContainer(container, current);

    container.addEventListener("scroll", save, { passive: true });
    onCleanup(() => container.removeEventListener("scroll", save));
  });
};

export { createScrollMemory };
export type { ScrollMemoryOptions };
