import { Tooltip } from "@andesine/components";
import clsx from "clsx";
import { type Component, type ComponentProps, Show } from "solid-js";
import { formatDateTime, formatRelativeTime } from "#web/lib/primitives";

interface TimeAgoProps {
  class?: string;
  date: Date | string;
  enabled?: boolean;
  meta?: string;
  offset?: ComponentProps<typeof Tooltip>["offset"];
  placement?: ComponentProps<typeof Tooltip>["placement"];
}

// Relative time with the exact date, and optional metadata above it, in a tooltip.
const TimeAgo: Component<TimeAgoProps> = (props) => (
  <Tooltip
    content={
      <div class="flex flex-col items-start justify-center gap-px">
        <Show when={props.meta}>
          {(meta) => <span class="mb-0.5 font-mono text-[80%] opacity-50">{meta()}</span>}
        </Show>
        <span>{formatDateTime(props.date)}</span>
      </div>
    }
    wrapperClass={clsx("!inline-flex min-w-0", props.class)}
    enabled={props.enabled}
    offset={props.offset}
    placement={props.placement}
    fixed
  >
    <span class="truncate">{formatRelativeTime(props.date)}</span>
  </Tooltip>
);

export { TimeAgo };
