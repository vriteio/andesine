import { Button, Card, ToggleGroup } from "@andesine/components";
import { createAsync, revalidate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { batch, type Component, createSignal, type JSX, Show, Suspense } from "solid-js";
import { ActionConfirmationDialog } from "#web/components/action-confirmation-dialog";
import { useNotify } from "#web/context/notifications";
import {
  getWebhookErrorCode,
  type WebhookEvent,
  type WebhookEventState,
  webhookEventsQuery
} from "#web/lib/data";
import { Setting } from "../../setting";
import { SettingsSection } from "../../settings-section";
import { getWebhookHost } from "../../webhook/configuration";
import type { WebhookEventsEndpoint, WebhookEventsSource } from "../source";
import { formatEventCount, getReplayLabel } from "./event-item";
import { EventTreeSkeleton } from "./event-skeleton";
import { EventTree } from "./event-tree";
import { TestEventSetting } from "./test-event-setting";

interface EventsSectionProps {
  source: WebhookEventsSource;
}

type EventFilter = WebhookEventState | "all";

const getFilterLabel = (label: string, count: number | undefined) => (
  <span class="flex items-center gap-1">
    {label}
    <Show when={count}>
      <span class="text-xs text-gray-400">{count}</span>
    </Show>
  </span>
);
const getFilterOptions = (webhook: WebhookEventsEndpoint | null | undefined) => {
  const options: Array<{ value: EventFilter; label: JSX.Element }> = [
    { value: "all", label: "All" },
    {
      value: "failed",
      label: getFilterLabel("Failed", webhook?.health.failedCount)
    },
    {
      value: "pending",
      label: getFilterLabel("Pending", webhook?.health.pendingCount)
    },
    { value: "succeeded", label: "Delivered" }
  ];

  return options;
};

const getReplayErrorMessage = (code: string | undefined) => {
  if (code === "CONFLICT") {
    return "Replay is unavailable: the webhook is disabled, its URL changed, or an event has an active run";
  }

  if (code === "FORBIDDEN") return "You cannot replay this event's content";
  if (code === "NOT_FOUND") return "This event has expired";
  if (code === "TOO_MANY_REQUESTS") return "Too many replays. Try again shortly";

  return "Failed to replay. Check the event before trying again";
};
const EventsSection: Component<EventsSectionProps> = (props) => {
  const notify = useNotify();
  const [filter, setFilter] = createSignal<EventFilter>("all");
  const [pageCount, setPageCount] = createSignal(1);
  const [replayTargets, setReplayTargets] = createSignal<WebhookEvent[]>([]);
  const deliveries = createAsync(() => {
    const state = filter() === "all" ? undefined : (filter() as WebhookEventState);

    return webhookEventsQuery({ ...props.source.target, state, pageCount: pageCount() });
  });
  const events = () => deliveries()?.data || [];
  const replayMutation = createMutation(() => ({
    retry: false,
    mutationFn: (deliveryIDs: string[]) => props.source.replay(deliveryIDs),
    onSuccess: (_, deliveryIDs) => {
      const count = deliveryIDs.length;

      setReplayTargets([]);
      notify({ type: "success", text: count === 1 ? "Replay queued" : `${count} replays queued` });
    },
    onError: (error) => {
      console.error(error);
      setReplayTargets([]);
      notify({ type: "error", text: getReplayErrorMessage(getWebhookErrorCode(error)) });
      void revalidate([
        "webhook",
        "extension-webhooks",
        "webhook-events",
        "webhook-event-timeline"
      ]);
    }
  }));
  const replayLabel = () => getReplayLabel(replayTargets());
  const changeFilter = (value: EventFilter) => {
    batch(() => {
      setFilter(value);
      setPageCount(1);
    });
  };

  return (
    <>
      <ActionConfirmationDialog
        opened={replayTargets().length > 0}
        title={`${replayLabel()} ${replayTargets().length === 1 ? "event" : formatEventCount(replayTargets().length)}?`}
        description={`Andesine sends the original events again to ${getWebhookHost(
          props.source.endpoint?.url || ""
        )}, with the same event IDs and payloads. Receivers should ignore events they already processed.`}
        affected={replayTargets().map((event) => ({
          id: event.id,
          icon: "i-lucide:send",
          label: event.type
        }))}
        action={{
          color: "primary",
          label: replayLabel(),
          loading: replayMutation.isPending,
          onClick: () => replayMutation.mutate(replayTargets().map(({ id }) => id))
        }}
        onClose={() => {
          if (!replayMutation.isPending) setReplayTargets([]);
        }}
      />
      <SettingsSection label="Events">
        <Show when={props.source.canTest && props.source.endpoint}>
          <TestEventSetting source={props.source} />
        </Show>
        <Setting
          label="Event deliveries"
          description="Events sent to this webhook, newest first. Each is kept until it expires"
          fade={false}
        >
          <ToggleGroup
            value={filter()}
            setValue={(value) => changeFilter(value as EventFilter)}
            options={getFilterOptions(props.source.endpoint)}
          />
        </Setting>
        <Suspense fallback={<EventTreeSkeleton />}>
          <Show
            when={events().length && props.source.endpoint}
            fallback={
              <Card
                class="flex h-16 items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm text-gray-400"
                shade
              >
                <div class="i-lucide:send h-5.5 w-5.5 text-gray-300" />
                No events
              </Card>
            }
          >
            <EventTree events={events()} source={props.source} onReplay={setReplayTargets} />
          </Show>
          <Show when={deliveries()?.pagination.hasMore}>
            <Button
              variant="ghost"
              text="soft"
              class="mt-1 self-center"
              onClick={() => setPageCount((current) => current + 1)}
            >
              Load more
            </Button>
          </Show>
        </Suspense>
      </SettingsSection>
    </>
  );
};

export { EventsSection };
