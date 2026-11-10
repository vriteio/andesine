import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

interface PageScrollbarOptions {
  /** Space between the track ends and the viewport edges, in pixels. */
  inset?: number;
  /** Width of the zone at the right edge where the pointer shows the scrollbar, in pixels. */
  edgeZone?: number;
  minThumbHeight?: number;
  /** Time that the scrollbar stays after scrolling stops, in milliseconds. */
  hideDelay?: number;
}

interface PageScrollbar {
  /** The thumb position; undefined when the page does not scroll, or scrolling is locked. */
  thumb: Accessor<PageScrollbarThumb | undefined>;
  /** The page scrolls, or the pointer is near the scrollbar or drags it. */
  visible: Accessor<boolean>;
  /** The pointer is near the scrollbar or drags it, so the scrollbar takes pointer input. */
  interactive: Accessor<boolean>;
  /** Scrolls the page to a click on the track. */
  onTrackPointerDown(event: PointerEvent): void;
  thumbHandlers: PageScrollbarThumbHandlers;
}

interface PageScrollbarThumb {
  top: number;
  height: number;
}

interface PageScrollbarThumbHandlers {
  onPointerDown(event: PointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(): void;
  onPointerCancel(): void;
  onLostPointerCapture(): void;
}

/**
 * An overlay scrollbar for the page, for layouts that hide the native one so pages with and
 * without overflow have the same width. It shows while the page scrolls, or when the pointer is
 * near the right edge, and supports dragging and track clicks.
 */
const createPageScrollbar = (options: PageScrollbarOptions = {}): PageScrollbar => {
  const [metrics, setMetrics] = createSignal<PageScrollbarThumb & { ratio: number }>();
  const [scrolling, setScrolling] = createSignal(false);
  const [near, setNear] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  const inset = options.inset ?? 4;
  const interactive = (): boolean => near() || dragging();

  let dragStart = 0;
  let scrollStart = 0;

  const scrollTo = (top: number): void => window.scrollTo({ top, behavior: "instant" });
  const stopDragging = (): void => {
    setDragging(false);
  };

  onMount(() => {
    const edgeZone = options.edgeZone ?? 16;
    const minThumbHeight = options.minThumbHeight ?? 24;

    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const measure = (): void => {
      const root = document.documentElement;
      const viewport = window.innerHeight;
      const maximum = root.scrollHeight - viewport;
      const locked = getComputedStyle(document.body).overflow === "hidden";
      const track = viewport - inset * 2;
      const height = Math.max(minThumbHeight, (track * viewport) / root.scrollHeight);

      frame = 0;
      setMetrics(
        maximum > 0 && !locked
          ? {
              top: inset + (window.scrollY / maximum) * (track - height),
              height,
              ratio: maximum / (track - height)
            }
          : undefined
      );
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(measure);
    };
    const onScroll = (): void => {
      schedule();
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), options.hideDelay ?? 1000);
    };
    const onPointerMove = (event: PointerEvent): void => {
      setNear(event.pointerType === "mouse" && event.clientX >= window.innerWidth - edgeZone);
    };
    const observer = new ResizeObserver(schedule);
    // Dialogs lock scrolling with a body style.
    const styleObserver = new MutationObserver(schedule);

    observer.observe(document.body);
    styleObserver.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    measure();
    onCleanup(() => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      observer.disconnect();
      styleObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pointermove", onPointerMove);
    });
  });

  return {
    thumb: () => {
      const current = metrics();

      return current && { top: current.top, height: current.height };
    },
    visible: () => Boolean(metrics() && (scrolling() || interactive())),
    interactive,
    onTrackPointerDown: (event) => {
      const current = metrics();

      if (event.button !== 0 || !current) return;

      scrollTo((event.clientY - inset - current.height / 2) * current.ratio);
    },
    thumbHandlers: {
      onPointerDown: (event) => {
        if (event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        dragStart = event.clientY;
        scrollStart = window.scrollY;
        setDragging(true);
      },
      onPointerMove: (event) => {
        const current = metrics();

        if (dragging() && current) {
          scrollTo(scrollStart + (event.clientY - dragStart) * current.ratio);
        }
      },
      onPointerUp: stopDragging,
      onPointerCancel: stopDragging,
      onLostPointerCapture: stopDragging
    }
  };
};

export { createPageScrollbar };
export type { PageScrollbarOptions, PageScrollbarThumb, PageScrollbarThumbHandlers, PageScrollbar };
