import { Skeleton } from "@andesine/components";
import clsx from "clsx";
import { type Component, For } from "solid-js";

const EVENT_ITEM_HEIGHT = "2.75rem";
const labelWidths = ["w-44", "w-52", "w-40"];

// Mirrors an event row like the version history skeleton: label and time above the event ID.
const EventTreeSkeleton: Component = () => (
  <div class="flex flex-col gap-0.5">
    <For each={labelWidths}>
      {(width) => (
        <div class="flex items-center gap-1.5 px-1" style={{ height: EVENT_ITEM_HEIGHT }}>
          <div class="flex min-w-0 flex-1 items-start gap-1.5">
            <Skeleton class="h-5 w-5 rounded-md" />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="flex items-center justify-between gap-2">
                <Skeleton class={clsx("h-5 rounded-md", width)} />
                <Skeleton class="h-3 w-20 rounded-[0.25rem]" />
              </div>
              <Skeleton class="h-3 w-36 rounded-[0.25rem]" />
            </div>
          </div>
        </div>
      )}
    </For>
  </div>
);

export { EVENT_ITEM_HEIGHT, EventTreeSkeleton };
