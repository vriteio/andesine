import { Skeleton } from "@andesine/components";
import clsx from "clsx";
import { type Component, For } from "solid-js";

const CommentsSkeleton: Component = () => {
  return (
    <div class="flex flex-col gap-3">
      <For each={["w-32", "w-40", "w-28"]}>
        {(width) => (
          <div class="flex flex-col gap-2 px-1 py-1">
            <div class="flex items-start gap-1.5">
              <Skeleton class="h-5 w-5 rounded-md" />
              <Skeleton class={[clsx("h-5 rounded-md", width), "h-3 w-20 rounded-[0.25rem]"]} />
            </div>
            <div class="flex items-start gap-1.5">
              <Skeleton class="h-5 w-5 rounded-md" />
              <Skeleton class={["h-5 w-24 rounded-md", "h-3 w-28 rounded-[0.25rem]"]} />
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
const CommentsPanelFallback: Component = () => {
  return (
    <div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-1">
      <div class="flex h-9 shrink-0 items-center">
        <h2 class="text-2xl font-semibold">Comments</h2>
      </div>
      <CommentsSkeleton />
    </div>
  );
};

export { CommentsPanelFallback, CommentsSkeleton };
