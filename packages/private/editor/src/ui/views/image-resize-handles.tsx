import { For } from "solid-js";
import clsx from "clsx";
import type { createImageResize } from "./image-resize";

interface ImageResizeHandlesProps {
  resize: ReturnType<typeof createImageResize>;
}

const ImageResizeHandles = (props: ImageResizeHandlesProps) => (
  <For each={["left", "right"] as const}>
    {(side) => (
      <button
        type="button"
        aria-label={`Resize image from ${side}`}
        class={clsx(
          "absolute inset-y-0 z-1 flex w-6 touch-none cursor-ew-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
          side === "left" ? "left-0" : "right-0",
          props.resize.size() !== null && "opacity-100"
        )}
        onPointerDown={(event) => props.resize.onPointerDown(event, side === "right" ? 1 : -1)}
        onKeyDown={props.resize.onKeyDown}
      >
        <span class="h-12 w-1.5 rounded-full bg-white shadow ring-1 ring-black/20" />
      </button>
    )}
  </For>
);

export { ImageResizeHandles };
