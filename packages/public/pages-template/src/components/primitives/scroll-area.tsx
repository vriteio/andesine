import { ScrollArea as ArkScrollArea } from "@ark-ui/solid/scroll-area";
import clsx from "clsx";
import { type ParentComponent, Show } from "solid-js";

interface ScrollAreaProps {
  orientation?: "vertical" | "horizontal";
  class?: string;
  viewportClass?: string;
  contentClass?: string;
  /** Fades the top and bottom edges while content scrolls past them. Vertical only. */
  shadow?: boolean;
  viewportRef?(element: HTMLDivElement): void;
}

const shadowClass =
  "pointer-events-none absolute inset-x-0 z-1 h-12 from-gray-50 to-gray-50/0 opacity-0 transition-opacity duration-150";
// Shown while the pointer is over the area, or while it scrolls.
const scrollbarClass =
  ":base: z-10 flex media-touch:hidden opacity-0 transition-opacity duration-200 data-[hover]:opacity-100 data-[scrolling]:opacity-100";
// A transparent border insets the thumb on any background.
const thumbClass =
  ":base: rounded-lg border-2 border-solid border-transparent bg-gray-200 bg-clip-padding shadow-inner";

/**
 * Scrolls its content in one direction, with an overlay scrollbar.
 * Ark sets `position: relative` on the root, so position a wrapper instead, e.g. with `sticky`.
 */
const ScrollArea: ParentComponent<ScrollAreaProps> = (props) => {
  const horizontal = (): boolean => props.orientation === "horizontal";

  return (
    <ArkScrollArea.Root
      class={clsx(
        ":base: relative flex min-h-0 overflow-hidden",
        !horizontal() && ":base: flex-col",
        props.class
      )}
    >
      <ArkScrollArea.Viewport
        ref={props.viewportRef}
        class={clsx(
          "peer",
          ":base: w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Touch screens keep their native overlay scrollbars.
          "media-touch:[scrollbar-width:auto] media-touch:[&::-webkit-scrollbar]:block",
          // A percent height does not resolve under a `max-height`, so a column flex item sizes it.
          horizontal()
            ? ":base: h-full overflow-y-hidden!"
            : ":base: min-h-0 flex-1 overflow-x-hidden!",
          props.viewportClass
        )}
      >
        {/* Ark sets `min-width: fit-content`, which only horizontal scrolling needs. */}
        <ArkScrollArea.Content class={clsx(!horizontal() && ":base: min-w-0!", props.contentClass)}>
          {props.children}
        </ArkScrollArea.Content>
      </ArkScrollArea.Viewport>
      <Show when={props.shadow && !horizontal()}>
        <div
          aria-hidden="true"
          class={clsx(
            shadowClass,
            "top-0 bg-gradient-to-b peer-[[data-overflow-y]:not([data-at-top])]:opacity-100"
          )}
        />
        <div
          aria-hidden="true"
          class={clsx(
            shadowClass,
            "bottom-0 bg-gradient-to-t peer-[[data-overflow-y]:not([data-at-bottom])]:opacity-100"
          )}
        />
      </Show>
      <ArkScrollArea.Context>
        {(scrollArea) => (
          <Show when={horizontal() ? scrollArea().hasOverflowX : scrollArea().hasOverflowY}>
            <ArkScrollArea.Scrollbar
              orientation={props.orientation ?? "vertical"}
              class={clsx(
                scrollbarClass,
                horizontal() ? ":base: h-3 flex-col px-2.5" : ":base: w-3 py-2.5"
              )}
            >
              <ArkScrollArea.Thumb class={clsx(thumbClass, horizontal() ? "h-full" : "w-full")} />
            </ArkScrollArea.Scrollbar>
          </Show>
        )}
      </ArkScrollArea.Context>
    </ArkScrollArea.Root>
  );
};

export { ScrollArea };
export type { ScrollAreaProps };
