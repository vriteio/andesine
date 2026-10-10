import { Spinner, Tooltip } from "@andesine/components";
import { createAsync } from "@solidjs/router";
import clsx from "clsx";
import { type Component, ErrorBoundary, For, Show, Suspense } from "solid-js";
import {
  getWebhookFailureSummary,
  getWebhookNextAttemptLabel,
  type WebhookAttempt,
  type WebhookEvent,
  type WebhookQueryInput,
  type WebhookRun,
  type WebhookRunTimeline,
  webhookEventQuery,
  webhookEventTimelineQuery
} from "#web/lib/data";
import { formatDateTime, formatDuration, formatRelativeTime } from "#web/lib/primitives";
import { PayloadView } from "./payload-view";

interface EventDetailsProps {
  event: WebhookEvent;
  target: WebhookQueryInput;
}
interface TimelineProps {
  timeline: WebhookRunTimeline[];
}
interface AttemptBadgeProps {
  attempt: WebhookAttempt;
  run: WebhookRun;
}
interface RunBadgeProps {
  run: WebhookRun;
}

type RunTrigger = WebhookRun["trigger"];
type StopReason = NonNullable<WebhookRun["stopReason"]>;
type AttemptOutcome = WebhookAttempt["outcome"];
type LateOutcome = NonNullable<WebhookAttempt["lateResult"]>["outcome"];

const runTriggerLabels: Record<RunTrigger, string> = {
  automatic: "Automatic run",
  manual: "Replay",
  test: "Test"
};
const stopReasonLabels: Record<StopReason, string> = {
  retry_exhausted: "Retries exhausted",
  expired: "Expired",
  disabled: "Webhook disabled",
  endpoint_deleted: "Webhook deleted",
  destination_changed: "URL changed",
  selection_changed: "Events or scope changed",
  access_revoked: "Content access lost",
  destination_policy: "Destination not allowed",
  test_completed: "Test finished"
};
const attemptOutcomeLabels: Record<AttemptOutcome, string> = {
  in_flight: "Sending",
  succeeded: "Delivered",
  failed: "Failed",
  unknown: "Result unknown"
};
// Non-circle icons keep attempts distinct from event state icons.
const attemptOutcomeIcons: Record<AttemptOutcome, string> = {
  in_flight: "i-lucide:send bg-gradient-to-tr from-primary to-secondary",
  succeeded: "i-lucide:check text-green-500",
  failed: "i-lucide:x text-red-500",
  unknown: "i-lucide:badge-question-mark text-amber-500"
};
const lateOutcomeLabels: Record<LateOutcome, string> = {
  succeeded: "delivered",
  receiver_failure: "failed",
  platform_failure: "failed in Andesine"
};
// Matches the outlined tag style of TagList; only the icon is color-coded.
const badgeClass =
  "flex h-6 max-w-full items-center gap-1 rounded-lg bg-white px-1.5 text-sm text-gray-500 shadow-md shadow-gray-200 outline outline-1 -outline-offset-1 outline-gray-200";

const AttemptBadge: Component<AttemptBadgeProps> = (props) => {
  const summary = () =>
    getWebhookFailureSummary(props.attempt.httpStatus, props.attempt.failureCategory);
  const details = () => {
    const duration = formatDuration(props.attempt.durationMs);

    return [summary(), duration].filter(Boolean).join(" · ");
  };

  return (
    <Tooltip
      content={
        <div class="flex flex-col items-start justify-center gap-px">
          <span class="mb-0.5 font-mono text-[80%] opacity-50">
            Attempt {props.attempt.number} · {runTriggerLabels[props.run.trigger]}
          </span>
          <span class="mb-0.5">{formatDateTime(props.attempt.startedAt)}</span>
          <span>{details()}</span>
          <Show when={props.attempt.lateResult}>
            {(late) => <span>Later {lateOutcomeLabels[late().outcome]}</span>}
          </Show>
        </div>
      }
      fixed
    >
      <span class={badgeClass}>
        <span class={clsx("h-4 w-4 shrink-0", attemptOutcomeIcons[props.attempt.outcome])} />
        <span class="truncate">
          {summary() || attemptOutcomeLabels[props.attempt.outcome]}{" "}
          <span class="text-gray-400 font-mono text-xs">#{props.attempt.number}</span>
        </span>
      </span>
    </Tooltip>
  );
};
// Ghost badge that starts each run's row, with the run number in its corner.
const RunBadge: Component<RunBadgeProps> = (props) => (
  <Tooltip
    content={
      <div class="flex flex-col items-start justify-center gap-px">
        <span class="mb-0.5 font-mono text-[80%] opacity-50">
          Run {props.run.number} · {runTriggerLabels[props.run.trigger]}
        </span>
        <span>{formatDateTime(props.run.createdAt)}</span>
        <Show when={props.run.stopReason}>
          {(reason) => <span>Stopped: {stopReasonLabels[reason()]}</span>}
        </Show>
      </div>
    }
    fixed
  >
    <span class="relative flex h-6 w-6 items-center justify-center rounded-lg text-gray-500">
      <span class="i-lucide:play h-4 w-4" />
      <span class="absolute -bottom-0.5 -right-0.5 font-mono text-[0.5625rem] text-gray-400 leading-none">
        #{props.run.number}
      </span>
    </span>
  </Tooltip>
);
// Runs and their attempts, latest first; each run is one wrapping row of badges.
const Timeline: Component<TimelineProps> = (props) => {
  const runs = () =>
    [...props.timeline].sort((first, second) => second.run.number - first.run.number);
  const latestRun = () => runs()[0]?.run;
  const nextAttemptAt = () => {
    return latestRun()?.state === "pending" ? latestRun()?.nextAttemptAt : null;
  };

  return (
    <div class="flex flex-col gap-1 pl-3">
      <For each={runs()} fallback={<span class="text-xs text-gray-400">No attempts yet</span>}>
        {(entry, index) => (
          <div class="flex min-w-0 flex-col">
            <div class="flex min-w-0 flex-wrap items-center gap-1">
              <RunBadge run={entry.run} />
              <Show when={index() === 0 && nextAttemptAt()}>
                {(date) => (
                  <Tooltip content={formatDateTime(date())} fixed>
                    <span class={badgeClass}>
                      <span class="i-lucide:hourglass h-4 w-4 shrink-0 bg-gradient-to-tr from-primary to-secondary" />
                      <span class="truncate">
                        {getWebhookNextAttemptLabel(date())} {formatRelativeTime(date())}
                      </span>
                    </span>
                  </Tooltip>
                )}
              </Show>
              <For
                each={[...entry.attempts].sort((first, second) => second.number - first.number)}
                fallback={
                  <Show when={!(index() === 0 && nextAttemptAt())}>
                    <span class="flex h-6 items-center text-xs text-gray-400">No attempts yet</span>
                  </Show>
                }
              >
                {(attempt) => <AttemptBadge attempt={attempt} run={entry.run} />}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
const EventDetails: Component<EventDetailsProps> = (props) => {
  const input = () => ({ ...props.target, deliveryID: props.event.id });
  const details = createAsync(() => webhookEventQuery(input()));
  const timeline = createAsync(() => webhookEventTimelineQuery(input()));

  return (
    <div class="flex">
      <div class="flex min-w-3.5 justify-end pl-0.5">
        <div class="-mt-4 h-[calc(100%+1rem)] w-px rounded-full bg-gray-300" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-2 my-1">
        <ErrorBoundary
          fallback={
            <div class="flex h-6 items-center gap-1.5 text-xs pl-4">
              <div class="i-lucide:circle-alert h-4 w-4 shrink-0 text-gray-400" />
              Details could not be loaded. They may have expired
            </div>
          }
        >
          <Suspense
            fallback={
              <div class="flex h-6 items-center gap-1.5 text-xs pl-4">
                <Spinner size="small" class="text-gray-400" />
                Loading details
              </div>
            }
          >
            <Timeline timeline={timeline() || []} />
            <Show when={details()}>
              {(loaded) => <PayloadView payload={loaded().payload} class="pl-4" />}
            </Show>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export { EventDetails };
