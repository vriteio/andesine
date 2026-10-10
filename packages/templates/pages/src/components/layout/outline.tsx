import type { HeadingContext } from "@andesine/pages";
import {
  TableOfContents,
  type TableOfContentsGuideRange,
  createTableOfContentsGuide,
  useTableOfContents
} from "@andesine/ui/solid";
import clsx from "clsx";
import { type Component, For, Show, createUniqueId } from "solid-js";
import { ScrollArea } from "../primitives/scroll-area";

interface OutlineProps {
  headings: HeadingContext[];
}

interface OutlineListProps extends OutlineProps {
  viewport(): HTMLElement | undefined;
  level(heading: HeadingContext): number;
}

const OutlineList: Component<OutlineListProps> = (props) => {
  const toc = useTableOfContents();
  const gradientID = createUniqueId();
  const highlighted = (): string[] => {
    const visible = toc.visibleIDs();

    return visible.length ? visible : [toc.activeID() ?? ""];
  };
  const levels = new Map(props.headings.map((heading) => [heading.id, props.level(heading)]));
  const guide = createTableOfContentsGuide({
    ids: () => props.headings.map((heading) => heading.id),
    highlightedIDs: highlighted,
    position: (id) => 8.5 + (levels.get(id) ?? 0) * 8,
    viewport: props.viewport
  });
  const range = (): TableOfContentsGuideRange | undefined => guide.stroke()?.range;

  return (
    <div ref={guide.trackRef} class="relative">
      <Show when={guide.stroke()?.backdrop}>
        {(backdrop) => (
          <svg aria-hidden="true" class="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id={`${gradientID}-backdrop`}>
                <stop
                  offset="0%"
                  style={{ "stop-color": "var(--color-secondary)", "stop-opacity": 0.1 }}
                />
                <stop
                  offset="50%"
                  style={{ "stop-color": "var(--color-primary)", "stop-opacity": 0.05 }}
                />
                <stop
                  offset="100%"
                  style={{ "stop-color": "var(--color-secondary)", "stop-opacity": 0 }}
                />
              </linearGradient>
            </defs>
            {/* The attribute is for Safari; browsers with the CSS `d` property animate it. */}
            <path
              d={backdrop()}
              fill={`url(#${gradientID}-backdrop)`}
              class="[transition:d_200ms_ease-out]"
              style={{ d: `path("${backdrop()}")` }}
            />
          </svg>
        )}
      </Show>
      <TableOfContents.List
        class={clsx(
          "relative flex flex-col text-sm leading-5",
          // Without scripts, a plain line stands in for the guide.
          !guide.stroke() &&
            "[@media(scripting:none)]:border-l [@media(scripting:none)]:border-gray-200"
        )}
      >
        <For each={props.headings}>
          {(heading) => (
            <TableOfContents.Item>
              <TableOfContents.Link
                ref={(element: HTMLAnchorElement) => guide.linkRef(heading.id, element)}
                headingID={heading.id}
                class={clsx(
                  "block py-1 pr-2 transition duration-200 ease-out [overflow-wrap:anywhere]",
                  highlighted().includes(heading.id)
                    ? "text-gray-700"
                    : "text-gray-500 @hover:text-gray-800 focus-visible:text-gray-800"
                )}
                style={{ "padding-inline-start": `${20 + (levels.get(heading.id) ?? 0) * 12}px` }}
              >
                {/* The guide needs the rendered layout, so the text shows as skeleton lines until then. */}
                <span class={clsx(!guide.stroke() && "outline-skeleton")}>{heading.text}</span>
              </TableOfContents.Link>
            </TableOfContents.Item>
          )}
        </For>
      </TableOfContents.List>
      <svg
        aria-hidden="true"
        class={clsx("pointer-events-none absolute left-0 top-0 h-full w-8 overflow-visible")}
        fill="none"
      >
        <path ref={guide.pathRef} class="stroke-gray-200" stroke-width="1" />
        <Show when={guide.stroke()}>
          {(stroke) => (
            <>
              <defs>
                <linearGradient
                  id={gradientID}
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1={(range()?.top ?? 0) + (range()?.height ?? 0)}
                  x2="16"
                  y2={range()?.top ?? 0}
                >
                  <stop offset="0%" style={{ "stop-color": "var(--color-secondary)" }} />
                  <stop offset="50%" style={{ "stop-color": "var(--color-primary)" }} />
                  <stop offset="100%" style={{ "stop-color": "var(--color-secondary)" }} />
                </linearGradient>
              </defs>
              <path
                d={stroke().path}
                stroke={`url(#${gradientID})`}
                stroke-width="2"
                stroke-linecap="round"
                stroke-dasharray={`${stroke().length} ${stroke().total}`}
                stroke-dashoffset={stroke().offset}
                class="[transition:stroke-dashoffset_200ms_ease-out,stroke-dasharray_200ms_ease-out]"
              />
            </>
          )}
        </Show>
      </svg>
    </div>
  );
};
const Outline: Component<OutlineProps> = (props) => {
  const minDepth = Math.min(...props.headings.map((heading) => heading.depth));

  let viewport: HTMLDivElement | undefined;

  return (
    <TableOfContents.Root
      headingIDs={props.headings.map((heading) => heading.id)}
      class="flex min-h-0 flex-col gap-2"
    >
      <p class="flex shrink-0 items-center gap-1.5 text-sm font-medium text-gray-500">
        <span aria-hidden="true" class="i-lucide:list h-4 w-4" />
        On this page
      </p>
      <ScrollArea shadow viewportRef={(element) => (viewport = element)} contentClass="py-2">
        <OutlineList
          headings={props.headings}
          viewport={() => viewport}
          level={(heading) => Math.min(2, heading.depth - minDepth)}
        />
      </ScrollArea>
    </TableOfContents.Root>
  );
};

export { Outline };
