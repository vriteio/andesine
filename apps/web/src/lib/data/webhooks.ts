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
  /** Selects an extension's webhook; `webhookID` is then its manifest webhook ID. */
  extensionID?: string;
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
interface DeliveryPageInput {
  cursor?: string;
  state?: WebhookEventState;
  limit: number;
}
interface WebhookRunTimeline {
  attempts: WebhookAttempt[];
  run: WebhookRun;
}

type Webhook = Awaited<ReturnType<typeof client.webhooks.get>>;
type WebhookEventType = WebhookEventName;
// Extension webhook history types also allow lifecycle events, so they cover both kinds.
type WebhookEventPage = Awaited<ReturnType<typeof client.extensions.listWebhookDeliveries>>;
type WebhookEvent = WebhookEventPage["data"][number];
type WebhookEventState = WebhookEvent["state"];
type WebhookRun = Awaited<ReturnType<typeof client.webhooks.listRuns>>["data"][number];
type WebhookAttempt = Awaited<ReturnType<typeof client.webhooks.listAttempts>>["data"][number];
type WebhookEventDetails = Awaited<ReturnType<typeof client.extensions.getWebhookDelivery>>;
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
const listDeliveries = (input: WebhookQueryInput, page: DeliveryPageInput) => {
  const { extensionID, webhookID } = input;

  return extensionID
    ? client.extensions.listWebhookDeliveries({ extensionID, webhookID, ...page })
    : client.webhooks.listDeliveries({ id: webhookID, ...page });
};
const getDelivery = (input: WebhookEventQueryInput) => {
  const { extensionID, webhookID, deliveryID } = input;

  return extensionID
    ? client.extensions.getWebhookDelivery({ extensionID, webhookID, deliveryID })
    : client.webhooks.getDelivery({ id: webhookID, deliveryID });
};
const listRuns = (input: WebhookEventQueryInput, cursor: string | undefined) => {
  const { extensionID, webhookID, deliveryID } = input;
  const page = { deliveryID, cursor, limit: 100 };

  return extensionID
    ? client.extensions.listWebhookRuns({ extensionID, webhookID, ...page })
    : client.webhooks.listRuns({ id: webhookID, ...page });
};
const listAttempts = (input: WebhookEventQueryInput, runID: string) => {
  const { extensionID, webhookID, deliveryID } = input;
  const page = { deliveryID, runID, limit: 100 };

  return extensionID
    ? client.extensions.listWebhookAttempts({ extensionID, webhookID, ...page })
    : client.webhooks.listAttempts({ id: webhookID, ...page });
};
// Rebuild the cursor chain on each refresh so page boundaries follow current results.
const webhookEventsQuery = query(async (input: WebhookEventsQueryInput) => {
  const result: WebhookEventPage = {
    data: [],
    pagination: { nextCursor: null, hasMore: false }
  };

  for (let index = 0; index < input.pageCount; index++) {
    const page = await listDeliveries(input, {
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
  return getDelivery(input);
}, "webhook-event");
// Replays can add any number of runs; attempts per run are bounded by the retry schedule.
const webhookEventTimelineQuery = query(async (input: WebhookEventQueryInput) => {
  const runs: WebhookRun[] = [];

  let cursor: string | undefined;

  do {
    const page = await listRuns(input, cursor);

    runs.push(...page.data);
    cursor = page.pagination.hasMore ? (page.pagination.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return Promise.all(
    runs.map(async (run): Promise<WebhookRunTimeline> => {
      const attempts = await listAttempts(input, run.id);

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
  WebhookQueryInput,
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
