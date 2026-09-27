import { type Accessor, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { getScrollOffset } from "../../core/scroll";

interface TableOfContentsOptions {
  headingIDs: Accessor<string[]>;
}

interface TableOfContents {
  activeID: Accessor<string | undefined>;
  /** Headings whose sections are in the viewport, below the sticky headers. */
  visibleIDs: Accessor<string[]>;
  /** Marks a heading as current until the user scrolls, e.g. after a link click. */
  select(id: string): void;
}

const scrollKeys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
const intentEvents = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

const createTableOfContents = (options: TableOfContentsOptions): TableOfContents => {
  const [activeID, setActiveID] = createSignal<string | undefined>(options.headingIDs()[0]);
  const [visibleIDs, setVisibleIDs] = createSignal<string[]>([]);

  let locked = false;
  let userScroll = false;

  onMount(() => {
    let headings: HTMLElement[] = [];
    let frame = 0;

    const update = (): void => {
      const offset = getScrollOffset() + 1;
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const tops = headings.map((heading) => heading.getBoundingClientRect().top);
      const passed = headings.filter((_, index) => tops[index]! <= offset);
      // A section ends at the next heading, or at the end of the heading's container.
      const visible = headings.filter((heading, index) => {
        const end = tops[index + 1] ?? heading.parentElement!.getBoundingClientRect().bottom;

        return tops[index]! < window.innerHeight && end > offset;
      });

      frame = 0;
      setVisibleIDs(visible.map((heading) => heading.id));

      if (locked) return;

      setActiveID((atBottom ? headings.at(-1) : (passed.at(-1) ?? headings[0]))?.id);
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(update);
    };
    const onIntent = (event: Event): void => {
      const isScrollKey = !(event instanceof KeyboardEvent) || scrollKeys.has(event.key);

      if (isScrollKey) userScroll = true;
    };
    const onScroll = (): void => {
      if (userScroll) locked = false;

      userScroll = false;
      schedule();
    };
    const observer = new ResizeObserver(schedule);

    createEffect(() => {
      headings = options.headingIDs().flatMap((id) => document.getElementById(id) ?? []);
      schedule();
    });
    observer.observe(document.body);
    intentEvents.forEach((name) => window.addEventListener(name, onIntent, { passive: true }));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", schedule);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intentEvents.forEach((name) => window.removeEventListener(name, onIntent));
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", schedule);
    });
  });

  return {
    activeID,
    visibleIDs,
    select: (id) => {
      locked = true;
      userScroll = false;
      setActiveID(id);
    }
  };
};

export { createTableOfContents };
export type { TableOfContentsOptions, TableOfContents };
