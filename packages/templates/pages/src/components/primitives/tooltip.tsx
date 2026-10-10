import { Tooltip as ArkTooltip } from "@ark-ui/solid/tooltip";
import clsx from "clsx";
import type { JSX, ParentComponent } from "solid-js";
import { Portal } from "solid-js/web";

interface TooltipProps {
  content: JSX.Element;
  class?: string;
}

const Tooltip: ParentComponent<TooltipProps> = (props) => (
  <ArkTooltip.Root
    openDelay={500}
    closeDelay={250}
    positioning={{ placement: "bottom", offset: { mainAxis: 6 } }}
  >
    <ArkTooltip.Trigger
      asChild={(triggerProps) => (
        <span {...triggerProps({ class: "inline-flex" })}>{props.children}</span>
      )}
    />
    <Portal>
      <ArkTooltip.Positioner>
        <ArkTooltip.Content
          class={clsx(
            ":base: relative z-80 flex whitespace-nowrap rounded-md bg-gray-800 px-1.5 py-1 text-xs leading-none text-gray-50 shadow-inner shadow-gray-900 ring-1 ring-gray-900 pointer-events-none",
            ":base: data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out",
            props.class
          )}
        >
          {props.content}
        </ArkTooltip.Content>
      </ArkTooltip.Positioner>
    </Portal>
  </ArkTooltip.Root>
);

export { Tooltip };
export type { TooltipProps };
