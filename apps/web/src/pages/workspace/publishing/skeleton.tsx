import { Skeleton } from "@andesine/components";
import { PanelLayout } from "#web/components/panel-layout";
import { TreeSkeleton } from "#web/components/tree";
import { type Component } from "solid-js";

const PublishingPanelContentSkeleton: Component = () => {
  return (
    <>
      <Skeleton class="my-1.5 h-7 w-full rounded-lg" />
      <TreeSkeleton />
    </>
  );
};
const PublishingPanelFallback: Component = () => {
  return (
    <PanelLayout title="Publishing" class="flex-1" subheader={<div class="h-4.5" />}>
      <PublishingPanelContentSkeleton />
    </PanelLayout>
  );
};

export { PublishingPanelContentSkeleton, PublishingPanelFallback };
