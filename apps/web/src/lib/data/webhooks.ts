import { query } from "@solidjs/router";
import {
  webhookEventCategories,
  webhookEventDefinitions,
  webhookEventNames,
  type WebhookEventDefinition,
  type WebhookEventName
} from "@andesine/contracts/webhooks";
import { client } from "#web/lib/api";

interface WebhookQueryInput {
  webhookID: string;
  workspaceID: string;
}
interface WebhookCatalogEvent extends WebhookEventDefinition {
  type: WebhookEventName;
}
interface WebhookEventsQueryInput extends WebhookQueryInput {
  pageCount: number;
  state?: WebhookEventState;
}
interface WebhookEventQueryInput extends WebhookQueryInput {
  deliveryID: string;
}
interface WebhookRunTimeline {
  attempts: WebhookAttempt[];
  run: WebhookRun;
}

type Webhook = Awaited<ReturnType<typeof client.webhooks.get>>;
type WebhookEventType = WebhookEventName;
type WebhookEventPage = Awaited<ReturnType<typeof client.webhooks.listDeliveries>>;
type WebhookEvent = WebhookEventPage["data"][number];
type WebhookEventState = WebhookEvent["state"];
type WebhookRun = Awaited<ReturnType<typeof client.webhooks.listRuns>>["data"][number];
type WebhookAttempt = Awaited<ReturnType<typeof client.webhooks.listAttempts>>["data"][number];
type WebhookEventDetails = Awaited<ReturnType<typeof client.webhooks.getDelivery>>;
type WebhookFailureCategory = NonNullable<WebhookEvent["lastFailureCategory"]>;

// The workspace ID is part of each cache key so workspace switches never reuse settings.
// Ten endpoints is the enforced maximum, so one page covers the whole list.
const webhooksQuery = query(async (_workspaceID: string) => {
  const result = await client.webhooks.list({ limit: 100 });

  return result.data;
}, "webhooks");
const webhookQuery = query(
  (input: WebhookQueryInput) => client.webhooks.get({ id: input.webhookID }),
  "webhook"
);
// Rebuild the cursor chain on each refresh so page boundaries follow current results.
const webhookEventsQuery = query(async (input: WebhookEventsQueryInput) => {
  const result: WebhookEventPage = {
    data: [],
    pagination: { nextCursor: null, hasMore: false }
  };

  for (let index = 0; index < input.pageCount; index++) {
    const page = await client.webhooks.listDeliveries({
      id: input.webhookID,
      cursor: result.pagination.nextCursor ?? undefined,
      state: input.state,
      limit: 25
    });

    result.data.push(...page.data);
    result.pagination = page.pagination;

    if (!page.pagination.hasMore) break;
  }

  return result;
}, "webhook-events");
const webhookEventQuery = query((input: WebhookEventQueryInput) => {
  return client.webhooks.getDelivery({ id: input.webhookID, deliveryID: input.deliveryID });
}, "webhook-event");
// Replays can add any number of runs; attempts per run are bounded by the retry schedule.
const webhookEventTimelineQuery = query(async (input: WebhookEventQueryInput) => {
  const request = { id: input.webhookID, deliveryID: input.deliveryID, limit: 100 };
  const runs: WebhookRun[] = [];

  let cursor: string | undefined;

  do {
    const page = await client.webhooks.listRuns({ ...request, cursor });

    runs.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return Promise.all(
    runs.map(async (run): Promise<WebhookRunTimeline> => {
      const attempts = await client.webhooks.listAttempts({ ...request, runID: run.id });

      return { run, attempts: attempts.data };
    })
  );
}, "webhook-event-timeline");
const webhookCatalogEvents: WebhookCatalogEvent[] = webhookEventNames.map((type) => ({
  type,
  ...webhookEventDefinitions[type]
}));

const webhookFailureCategoryLabels: Record<WebhookFailureCategory, string> = {
  http_status: "Error response",
  timeout: "Timed out",
  network: "Network error",
  destination_policy: "Blocked destination",
  internal: "Andesine error"
};

// Summarizes an HTTP status or failure category, e.g. "HTTP 503" or "Timed out".
const getWebhookFailureSummary = (
  httpStatus: number | null,
  category: WebhookFailureCategory | null
): string | null => {
  if (category === "http_status" && httpStatus) return `HTTP ${httpStatus}`;
  if (category) return webhookFailureCategoryLabels[category];

  return httpStatus ? `HTTP ${httpStatus}` : null;
};
// A due attempt waits for a worker; the time says when it became due.
const getWebhookNextAttemptLabel = (date: string) => {
  return new Date(date) > new Date() ? "Next attempt" : "Queued";
};
// Test samples and events with an active run cannot be replayed.
const isWebhookEventReplayable = (event: WebhookEvent) => {
  return !event.test && event.state !== "pending" && event.state !== "in_flight";
};
const getWebhookErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;

  return typeof error.code === "string" ? error.code : undefined;
};

export {
  getWebhookErrorCode,
  getWebhookFailureSummary,
  getWebhookNextAttemptLabel,
  isWebhookEventReplayable,
  webhookCatalogEvents,
  webhookEventsQuery,
  webhookEventQuery,
  webhookEventTimelineQuery,
  webhookEventCategories,
  webhookQuery,
  webhooksQuery
};
export type {
  Webhook,
  WebhookAttempt,
  WebhookCatalogEvent,
  WebhookEvent,
  WebhookEventDetails,
  WebhookEventPage,
  WebhookEventState,
  WebhookEventType,
  WebhookFailureCategory,
  WebhookRun,
  WebhookRunTimeline
};
