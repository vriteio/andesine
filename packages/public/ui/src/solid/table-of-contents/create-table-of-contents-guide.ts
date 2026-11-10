import { type Accessor, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { scrollIntoContainer } from "../../core/scroll";

interface TableOfContentsGuideOptions {
  ids: Accessor<string[]>;
  /** The links to highlight, in outline order. */
  highlightedIDs: Accessor<string[]>;
  /** The x position of the guide line for each link. */
  position(id: string): number;
  /** Scrolled to keep the highlighted links in view, e.g. the viewport of a long outline. */
  viewport?: Accessor<HTMLElement | undefined>;
  /** Space between the guide's ends and each link's top and bottom, in pixels. */
  inset?: number;
  /** Corner radius of the backdrop, in pixels. */
  radius?: number;
  /** Points on the guide line along the backdrop's left edge. */
  edgePoints?: number;
}

interface TableOfContentsGuide {
  stroke: Accessor<TableOfContentsGuideStroke | undefined>;
  trackRef(element: HTMLElement): void;
  linkRef(id: string, element: HTMLElement): void;
  pathRef(element: SVGPathElement): void;
}

interface TableOfContentsGuideShape {
  path: string;
  width: number;
  /** The highlighted links, relative to the track; undefined when no link is highlighted. */
  range?: TableOfContentsGuideRange;
}

interface TableOfContentsGuideStroke extends TableOfContentsGuideShape {
  /** Dash offset and length that draw the highlighted part of the path. */
  offset: number;
  length: number;
  total: number;
  /**
   * The highlighted area right of the guide line, with rounded corners. It always has the same
   * commands, so CSS can animate it.
   */
  backdrop?: string;
}

interface TableOfContentsGuideRange {
  top: number;
  height: number;
}

/**
 * Measures one guide path through all table of contents links, with curves between depths, the
 * dash that highlights a range of links, and a backdrop for that range.
 */
const createTableOfContentsGuide = (options: TableOfContentsGuideOptions): TableOfContentsGuide => {
  const [shape, setShape] = createSignal<TableOfContentsGuideShape>();
  const [stroke, setStroke] = createSignal<TableOfContentsGuideStroke>();
  const links = new Map<string, HTMLElement>();

  // Keeps the guide clear of the rounded ends of each link.
  const inset = options.inset ?? 6;
  const radius = options.radius ?? 8;
  const edgePoints = options.edgePoints ?? 16;

  let track: HTMLElement | undefined;
  let marker: SVGPathElement | undefined;

  onMount(() => {
    let frame = 0;

    const measure = (): void => {
      const bounds = track?.getBoundingClientRect();
      const segments = options.ids().flatMap((id) => {
        const rect = links.get(id)?.getBoundingClientRect();
        const x = options.position(id);

        return rect && bounds
          ? [{ id, x, top: rect.top - bounds.top, bottom: rect.bottom - bounds.top }]
          : [];
      });
      const highlighted = segments.filter((segment) => {
        return options.highlightedIDs().includes(segment.id);
      });
      const first = highlighted[0];
      const last = highlighted.at(-1);
      const width = bounds?.width ?? 0;
      const path = segments
        .map((segment, index) => {
          const previous = segments[index - 1];
          const line = `L ${segment.x} ${segment.bottom - inset}`;

          if (!previous) return `M ${segment.x} ${segment.top + inset} ${line}`;
          if (previous.x === segment.x) return line;

          const middle = (previous.bottom + segment.top) / 2;

          return `C ${previous.x} ${middle} ${segment.x} ${middle} ${segment.x} ${segment.top + inset} ${line}`;
        })
        .join(" ");

      frame = 0;
      setShape(
        segments.length
          ? {
              path,
              width,
              range: first &&
                last && {
                  top: first.top,
                  height: last.bottom - first.top
                }
            }
          : undefined
      );
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);

    createEffect(() => {
      options.highlightedIDs();
      schedule();
    });

    if (track) observer.observe(track);

    onCleanup(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    });
  });
  // The path only goes down, so a binary search by height finds the length at a point.
  createEffect(() => {
    const current = shape();

    if (!current || !marker) return setStroke(undefined);

    marker.setAttribute("d", current.path);

    const total = marker.getTotalLength();
    const lengthAt = (y: number): number => {
      let low = 0;
      let high = total;

      for (let step = 0; step < 20; step += 1) {
        const middle = (low + high) / 2;

        if (marker!.getPointAtLength(middle).y < y) {
          low = middle;
        } else {
          high = middle;
        }
      }

      return (low + high) / 2;
    };

    if (!current.range) {
      return setStroke({ ...current, offset: 0, length: 0, total });
    }

    const { top, height } = current.range;
    const bottom = top + height;
    const r = Math.min(radius, height / 2);
    const xAt = (y: number): number => marker!.getPointAtLength(lengthAt(y)).x;
    const edge = Array.from({ length: edgePoints }, (_, index) => {
      const y = bottom - r - ((height - 2 * r) * index) / (edgePoints - 1);

      return `L ${xAt(y)} ${y}`;
    });
    const [xTop, xBottom] = [xAt(top + r), xAt(bottom - r)];
    const backdrop = [
      `M ${xTop + r} ${top} L ${current.width - r} ${top}`,
      `Q ${current.width} ${top} ${current.width} ${top + r} L ${current.width} ${bottom - r}`,
      `Q ${current.width} ${bottom} ${current.width - r} ${bottom} L ${xBottom + r} ${bottom}`,
      `Q ${xBottom} ${bottom} ${xBottom} ${bottom - r}`,
      ...edge,
      `Q ${xTop} ${top} ${xTop + r} ${top} Z`
    ].join(" ");
    const start = lengthAt(top + inset);
    const end = lengthAt(bottom - inset);

    setStroke({ ...current, offset: -start, length: end - start, total, backdrop });
  });

  // Keeps the highlighted links visible in a long outline.
  createEffect(() => {
    const viewport = options.viewport?.();
    const first = links.get(options.highlightedIDs()[0] ?? "");

    if (viewport && first) scrollIntoContainer(viewport, first, 12);
  });

  return {
    stroke,
    trackRef: (element) => (track = element),
    linkRef: (id, element) => links.set(id, element),
    pathRef: (element) => (marker = element)
  };
};

export { createTableOfContentsGuide };
export type {
  TableOfContentsGuideOptions,
  TableOfContentsGuideRange,
  TableOfContentsGuideStroke,
  TableOfContentsGuide
};
