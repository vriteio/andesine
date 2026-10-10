import { createScrollEdges } from "@andesine/ui/solid";
import clsx from "clsx";
import type { Component } from "solid-js";

interface PageScrollShadowProps {
  /** Positions the top fade below the sticky header. */
  topClass: string;
}

const shadowClass =
  "absolute inset-x-0 h-16 from-gray-50 to-gray-50/0 transition-opacity duration-150";

/** Fades the page content at the viewport edges while it scrolls past them. */
const PageScrollShadow: Component<PageScrollShadowProps> = (props) => {
  const edges = createScrollEdges();

  return (
    <div aria-hidden="true" class="pointer-events-none sticky top-0 h-dvh">
      <div
        class={clsx(shadowClass, "bg-gradient-to-b", props.topClass, !edges.start() && "opacity-0")}
      />
      <div class={clsx(shadowClass, "bottom-0 bg-gradient-to-t", !edges.end() && "opacity-0")} />
    </div>
  );
};

export { PageScrollShadow };
