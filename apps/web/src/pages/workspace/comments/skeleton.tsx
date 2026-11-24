import { Skeleton } from "@andesine/components";
import clsx from "clsx";
import { type Component, For } from "solid-js";

const CommentsSkeleton: Component = () => {
  return (
    <div class="flex flex-col gap-1">
      <For each={["w-36", "w-44", "w-32", "w-40"]}>
        {(width) => (
          <div class="flex flex-col gap-1 py-1 pl-0.5">
            <div class="flex h-6 items-center gap-1">
              <div class="flex h-6 w-6 shrink-0 items-center justify-center">
                <Skeleton class="h-5 w-5 rounded-md" />
              </div>
              <Skeleton class={clsx("h-5 rounded-md", width)} />
            </div>
            <div class="-mt-1.5 flex h-4 items-center pl-7">
              <Skeleton class="h-3 w-16 rounded-[0.25rem]" />
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
