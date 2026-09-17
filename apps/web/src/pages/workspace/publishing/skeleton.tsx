import { Skeleton } from "@andesine/components";
import { TreeSkeleton } from "#web/components/tree";
import { type Component } from "solid-js";

const PublishingPanelContentSkeleton: Component = () => {
  return (
    <>
      <Skeleton class="my-1 h-7 w-full rounded-lg" />
      <TreeSkeleton />
    </>
  );
};
const PublishingPanelFallback: Component = () => {
  return (
    <div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-1">
      <div class="flex h-9 shrink-0 items-center">
        <h2 class="text-2xl font-semibold">Publishing</h2>
      </div>
      <PublishingPanelContentSkeleton />
    </div>
  );
};

export { PublishingPanelContentSkeleton, PublishingPanelFallback };
