import { Skeleton } from "@andesine/components";
import { type Component, type ParentComponent, Show, Suspense } from "solid-js";

interface AccessListProps {
  ready: boolean;
}

const AccessListSkeleton: Component = () => (
  <div class="flex flex-col">
    <div class="flex h-8 items-center gap-1 px-1">
      <Skeleton class={["h-6 w-6", "h-6 flex-1"]} />
    </div>
    <div class="flex h-8 items-center gap-1 px-1">
      <Skeleton class={["h-6 w-6", "h-6 flex-1"]} />
    </div>
  </div>
);

const AccessList: ParentComponent<AccessListProps> = (props) => (
  <Suspense fallback={<AccessListSkeleton />}>
    <Show when={props.ready} fallback={<AccessListSkeleton />}>
      {props.children}
    </Show>
  </Suspense>
);

export { AccessList };
