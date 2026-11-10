import clsx from "clsx";
import { Skeleton } from "@andesine/components";
import { type JSX, type ParentComponent, Show, Suspense } from "solid-js";

interface SettingProps {
  label: JSX.Element;
  description: JSX.Element;
  fade?: boolean;
  hover?: boolean;
  /**
   * Lays out by the width of the container, not the screen, e.g. in extension pages next to the
   * right panel: one row from 32rem, stacked in narrower panels.
   */
  container?: boolean;
}

const Setting: ParentComponent<SettingProps> = (props) => (
  <div
    class={clsx(
      "-mx-2 px-2 py-2 group/setting relative",
      props.fade !== false && "mask-edge-fading-b-4",
      props.container && "@container/setting"
    )}
  >
    <Show when={props.hover}>
      <div class="absolute h-full w-full top-0 left-0 media-mouse:group-hover/setting:bg-gradient-to-r from-gray-500/5 to-transparent -z-1 rounded-lg" />
    </Show>
    <div
      class={clsx(
        "flex flex-col items-start gap-3",
        props.container
          ? // Important: the base `flex-col` and `gap-3` come later in the stylesheet.
            "@lg/setting:!flex-row @lg/setting:justify-center @lg/setting:!gap-8 @2xl/setting:!gap-24"
          : "sm:gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-24"
      )}
    >
      <div
        class={clsx(
          "flex w-full min-w-0 flex-col",
          props.container ? "@lg/setting:max-w-72 @lg/setting:flex-1" : "lg:max-w-72 lg:flex-1"
        )}
      >
        <span class="flex-1 font-medium leading-tight">{props.label}</span>
        <span class="text-sm leading-tight text-gray-400">{props.description}</span>
      </div>
      <div
        class={clsx(
          "flex w-full min-w-0",
          props.container
            ? "flex-col @lg/setting:flex-1 @lg/setting:!flex-row @lg/setting:justify-end"
            : "lg:flex-1 lg:justify-end"
        )}
      >
        <Suspense fallback={<Skeleton class="h-7 w-full max-w-40 rounded-lg" />}>
          {props.children}
        </Suspense>
      </div>
    </div>
  </div>
);

export { Setting };
