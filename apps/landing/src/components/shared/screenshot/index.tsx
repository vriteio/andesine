import styles from "./styles.module.scss";
import { Card } from "@andesine/components/primitives";
import { DotsBackground } from "@andesine/components/fragments";
import { type Component } from "solid-js";
import clsx from "clsx";

interface ScreenshotProps {
  src: string;
  label: string;
  width: number;
  height: number;
  class?: string;
  imageClass?: string;
  eager?: boolean;
  fade?: boolean;
  entry?: "screenshot" | "hero";
  entryDelay?: number;
}

interface ScreenshotDotsProps {
  class?: string;
}

const Screenshot: Component<ScreenshotProps> = (props) => (
  <div
    class={clsx("bg-gray-50 relative rounded-xl! md:rounded-2xl!", props.class)}
    data-entry={props.entry || "screenshot"}
    data-entry-delay={props.entryDelay}
  >
    <Card
      shade
      class={clsx(
        "h-full w-full overflow-hidden bg-white! p-0 rounded-xl! md:rounded-2xl!",
        props.fade && styles.fade
      )}
    >
      <img
        src={props.src}
        width={props.width}
        height={props.height}
        alt={props.label}
        loading={props.eager ? "eager" : "lazy"}
        fetchpriority={props.eager ? "high" : undefined}
        decoding="async"
        class={clsx("block h-auto w-full", props.imageClass)}
      />
    </Card>
  </div>
);

// Shared backdrop dimensions keep dots clear of the copy below each screenshot.
const ScreenshotDots: Component<ScreenshotDotsProps> = (props) => (
  <DotsBackground
    class={clsx(
      "pointer-events-none absolute left-1/2 -top-32 w-[calc(100%+16rem)] max-w-[calc(100vw-1rem)] h-[calc(100%+8rem)] -translate-x-1/2 mask-edge-fading-24",
      props.class
    )}
    contrast
    aria-hidden="true"
  />
);

// Large fading image with an inset and copy on opposite sides.
// Mobile keeps all content in flow.
export { Screenshot, ScreenshotDots };
