import {
  type Card,
  DropdownArea,
  DropdownMenu,
  IconButton,
  type MenuItem,
  Tooltip
} from "@andesine/components";
import clsx from "clsx";
import {
  type Component,
  type ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  Show
} from "solid-js";
import { TimeAgo } from "#web/components/time-ago";
import { TreeItem, useTree } from "#web/components/tree";
import {
  getWebhookNextAttemptLabel,
  isWebhookEventReplayable,
  type WebhookEvent
} from "#web/lib/data";
import { formatDate, formatRelativeTime } from "#web/lib/primitives";
import type { WebhookEventsSource } from "../source";
import { EventDetails } from "./event-details";

interface EventItemProps {
  event: WebhookEvent;
  nextID?: string;
  previousID?: string;
  source: WebhookEventsSource;
  getEvents(ids: string[]): WebhookEvent[];
  onReplay(events: WebhookEvent[]): void;
}

type EventState = WebhookEvent["state"];

const gradientIcon = "bg-gradient-to-tr from-primary to-secondary";
const eventStateLabels: Record<EventState, string> = {
  pending: "Pending",
  in_flight: "Sending",
  succeeded: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled"
};
const eventStateIcons: Record<EventState, string> = {
  pending: `i-lucide:clock ${gradientIcon}`,
  in_flight: `i-lucide:send ${gradientIcon}`,
  succeeded: "i-lucide:circle-check text-green-500",
  failed: "i-lucide:circle-alert text-red-500",
  cancelled: "i-lucide:circle-slash text-gray-400"
};

const formatEventCount = (count: number) => (count === 1 ? "1 event" : `${count} events`);
// Replaying only failed events reads as a retry.
const getReplayLabel = (events: WebhookEvent[]) => {
  const allFailed = events.length > 0 && events.every(({ state }) => state === "failed");

  return allFailed ? "Retry" : "Replay";
};
// Events expand into a details panel instead of child tree items.
const EventItem: Component<EventItemProps> = (props) => {
  const [{ isExpanded, isSelected, selection }, { setSelection, toggleExpanded }] = useTree();
  const [menuOpened, setMenuOpened] = createSignal(false);
  // Selected neighbors join into one backdrop across the tree gap.
  const joinedAbove = () => Boolean(props.previousID && isSelected(props.previousID));
  const joinedBelow = () => Boolean(props.nextID && isSelected(props.nextID));
  const stateTooltip = () => {
    const nextAttemptAt = props.event.nextAttemptAt;
    const state = eventStateLabels[props.event.state];

    if (!nextAttemptAt) return state;

    return `${state}. ${getWebhookNextAttemptLabel(nextAttemptAt)} ${formatRelativeTime(nextAttemptAt)}`;
  };
  const replayUnavailable = () => {
    if (!props.source.endpoint?.enabled) return "Enable the webhook to replay";

    return isWebhookEventReplayable(props.event) ? false : "This event is already being sent";
  };
  // Group replay skips test samples and events with an active run.
  const multiMenuItems = (selected: WebhookEvent[]): MenuItem[][] => {
    const replayable = selected.filter(isWebhookEventReplayable);
    const count = formatEventCount(replayable.length || selected.length);
    const disabled = !props.source.endpoint?.enabled
      ? "Enable the webhook to replay"
      : !replayable.length && "None of the selected events can be replayed";

    return [
      [
        {
          label: `${getReplayLabel(replayable)} ${count}`,
          icon: "i-lucide:rotate-ccw",
          disabled,
          onClick: () => {
            props.onReplay(replayable);
            setSelection([]);
          }
        }
      ]
    ];
  };
  const menuItems = createMemo((): MenuItem[][] => {
    const selected = props.getEvents(selection());

    if (!props.source.canManage) return [];
    if (selected.length > 1) return multiMenuItems(selected);
    if (props.event.test) return [];

    return [
      [
        {
          label: getReplayLabel([props.event]),
          icon: "i-lucide:rotate-ccw",
          disabled: replayUnavailable(),
          onClick: () => props.onReplay([props.event])
        }
      ]
    ];
  });

  createEffect(() => {
    if (menuOpened()) {
      setSelection((selectedIDs) => {
        return selectedIDs.includes(props.event.id) ? selectedIDs : [props.event.id];
      });
    }
  });

  return (
    <div class="relative w-full">
      <Show when={isSelected(props.event.id)}>
        <div
          class={clsx(
            "pointer-events-none absolute inset-x-0 top-0 -z-10 bg-gradient-to-r from-secondary via-primary to-transparent opacity-10",
            joinedAbove() ? "rounded-t-none" : "rounded-t-lg",
            joinedBelow() ? "-bottom-0.5 rounded-b-none" : "bottom-0 rounded-b-lg"
          )}
        />
      </Show>
      <DropdownArea>
        <TreeItem
          id={props.event.id}
          label={props.event.type}
          topLevel
          checkbox={props.source.canManage}
          selectable={props.source.canManage}
          keyboardMenu={menuItems().flat()}
          onOpenMenu={() => {
            if (menuItems().length) setMenuOpened(true);
          }}
          iconClass="self-start mt-0.5"
          icon={
            <Tooltip content={stateTooltip()} fixed>
              <div class={clsx("h-5 w-5", eventStateIcons[props.event.state])} />
            </Tooltip>
          }
          onClick={() => toggleExpanded(props.event.id)}
          renderLabel={(label) => (
            <div class="flex min-w-0 flex-1 flex-col leading-tight">
              <div class="flex min-w-0 items-center gap-1.5">
                <span class="min-w-0 truncate font-mono text-sm">{label}</span>
                <Show when={props.event.test}>
                  <span class="shrink-0 rounded-md border border-gray-200 bg-gray-100 px-1 py-px text-xs text-gray-500">
                    Test
                  </span>
                </Show>
                <div class="flex-1" />
                <TimeAgo
                  class="shrink-0 text-xs font-normal text-gray-400"
                  date={props.event.createdAt}
                  meta={`Kept until ${formatDate(props.event.expiresAt)}`}
                />
              </div>
              <div class="flex w-full min-w-0 text-left text-[0.625rem] leading-4 font-normal font-mono text-gray-400">
                <span class="truncate">{props.event.eventID}</span>
              </div>
            </div>
          )}
          actions={
            <Show when={menuItems().length}>
              <div class="self-start" onClick={(event: MouseEvent) => event.stopPropagation()}>
                <DropdownMenu
                  title={props.event.type}
                  cardProps={
                    {
                      "class": "w-48",
                      "data-tree-interaction": ""
                    } as Partial<ComponentProps<typeof Card>>
                  }
                  opened={menuOpened()}
                  portal={false}
                  setOpened={setMenuOpened}
                  trigger={() => (
                    <div
                      class={clsx(
                        !menuOpened() && "opacity-20 media-mouse:group-hover:opacity-100"
                      )}
                    >
                      <IconButton icon="i-lucide:ellipsis-vertical" variant="ghost" />
                    </div>
                  )}
                  items={menuItems()}
                />
              </div>
            </Show>
          }
        />
      </DropdownArea>
      <Show when={isExpanded(props.event.id)}>
        <EventDetails event={props.event} target={props.source.target} />
      </Show>
    </div>
  );
};

export { EventItem, formatEventCount, getReplayLabel };
