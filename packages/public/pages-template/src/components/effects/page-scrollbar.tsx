import { createPageScrollbar } from "@andesine/ui/solid";
import clsx from "clsx";
import type { Component } from "solid-js";

/**
 * The overlay page scrollbar. The native one is hidden, so pages with and without overflow have
 * the same width. Touch screens keep their native scrollbar.
 */
const PageScrollbar: Component = () => {
  const scrollbar = createPageScrollbar();

  return (
    <div
      aria-hidden="true"
      class={clsx(
        "fixed inset-y-0 right-0.5 z-40 w-3 transition-opacity duration-200 media-touch:hidden",
        scrollbar.visible() ? "opacity-100" : "opacity-0",
        !scrollbar.thumb() && "hidden",
        !scrollbar.interactive() && "pointer-events-none"
      )}
      onPointerDown={scrollbar.onTrackPointerDown}
    >
      <div
        {...scrollbar.thumbHandlers}
        class="absolute inset-x-0 cursor-default rounded-lg border-2 border-solid border-transparent bg-gray-200 bg-clip-padding shadow-inner"
        style={{
          top: `${scrollbar.thumb()?.top ?? 0}px`,
          height: `${scrollbar.thumb()?.height ?? 0}px`
        }}
      />
    </div>
  );
};

export { PageScrollbar };
