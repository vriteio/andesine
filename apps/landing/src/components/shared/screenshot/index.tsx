import styles from "./styles.module.scss";
import { Card } from "@andesine/components/primitives";
import { DotsBackground } from "@andesine/components/fragments";
import { type Component, type ParentComponent, Show } from "solid-js";
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

interface ScreenshotShowcaseProps {
  main: ScreenshotProps;
  detail: ScreenshotProps;
  panel?: boolean;
  detailSide?: "left" | "right";
  dots?: boolean;
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
const ScreenshotShowcase: ParentComponent<ScreenshotShowcaseProps> = (props) => (
  <div class="relative isolate grid grid-cols-12">
    <Show when={props.dots}>
      <ScreenshotDots class="col-span-full row-start-1 row-end-3 md:row-end-2" />
    </Show>
    <Screenshot
      {...props.main}
      fade
      class={clsx(
        "col-span-full row-start-1 md:col-span-11",
        props.detailSide === "left" ? "md:col-start-2" : "md:col-start-1"
      )}
    />
    <Screenshot
      {...props.detail}
      fade
      class={clsx(
        "relative z-1 col-span-full row-start-2 mt-[-28%] ml-auto translate-x-2 [--fade-start:75%] md:row-start-1 md:mt-0 md:w-full md:translate-x-0 md:translate-y-16 md:self-end",
        props.panel ? "w-1/2 md:col-span-4" : "w-2/3 md:col-span-6",
        props.detailSide === "left"
          ? "md:col-start-1 md:mr-auto md:ml-0"
          : props.panel
            ? "md:col-start-9"
            : "md:col-start-7"
      )}
      entryDelay={250}
    />
    <div
      class={clsx(
        "col-span-full row-start-3 mt-6 text-base leading-relaxed text-gray-500 md:col-span-6 md:row-start-2 md:min-h-16",
        props.detailSide === "left" ? "md:col-start-7 md:pl-8" : "md:pr-8"
      )}
      data-entry="up"
    >
      {props.children}
    </div>
  </div>
);

export { Screenshot, ScreenshotDots, ScreenshotShowcase, type ScreenshotShowcaseProps };
