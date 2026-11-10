import { type Webhook, webhookCatalogEvents, type WebhookEventType } from "#web/lib/data";

interface WebhookDraft {
  name: string;
  url: string;
  enabled: boolean;
  eventTypes: WebhookEventType[];
  collections: Webhook["collections"];
  channels: Webhook["channels"];
  restrictedContent: boolean;
}
interface WebhookChangeNotice {
  id: string;
  icon: string;
  label: string;
  detail: string;
}

type WebhookScope = Webhook["collections"] | Webhook["channels"];
type WebhookDraftChanges = Partial<WebhookDraft>;

const MAX_SELECTED_SCOPE_ITEMS = 100;

// New webhooks start enabled; the server requires at least one selected event.
const createEmptyDraft = (): WebhookDraft => ({
  name: "",
  url: "",
  enabled: true,
  eventTypes: [],
  collections: { mode: "all" },
  channels: { mode: "all" },
  restrictedContent: false
});
const createDraftFromWebhook = (webhook: Webhook): WebhookDraft => ({
  name: webhook.name,
  url: webhook.url,
  enabled: webhook.enabled,
  eventTypes: [...webhook.eventTypes],
  collections: structuredClone(webhook.collections),
  channels: structuredClone(webhook.channels),
  restrictedContent: webhook.restrictedContent
});
const getWebhookHost = (url: string): string => {
  return URL.canParse(url) ? new URL(url).host : url;
};
const getScopeItems = (scope: WebhookScope): string[] => {
  if (scope.mode === "all") return [];

  return "roots" in scope ? scope.roots : scope.codes;
};
// Array order is not meaningful for selections, so compare sorted copies.
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize).sort();

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalize(entry)])
    );
  }

  return value;
};
const isSameValue = (a: unknown, b: unknown): boolean => {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
};
// The channel filter applies only to events that support it. Without such events it is
// hidden and saved as all channels; the draft keeps the selection in case it returns.
const usesChannelFilter = (eventTypes: WebhookEventType[]): boolean => {
  return webhookCatalogEvents.some((event) => {
    return eventTypes.includes(event.type) && event.filters.includes("channels");
  });
};
const getEffectiveDraft = (draft: WebhookDraft): WebhookDraft => {
  return usesChannelFilter(draft.eventTypes) ? draft : { ...draft, channels: { mode: "all" } };
};
const getDraftChanges = (draft: WebhookDraft, webhook: Webhook | null): WebhookDraftChanges => {
  const effective = getEffectiveDraft(draft);

  if (!webhook) return effective;

  const current = getEffectiveDraft(createDraftFromWebhook(webhook));
  const keys = Object.keys(effective) as Array<keyof WebhookDraft>;

  return Object.fromEntries(
    keys
      .filter((key) => !isSameValue(effective[key], current[key]))
      .map((key) => [key, effective[key]])
  );
};
const isValidWebhookURL = (value: string): boolean => {
  if (!URL.canParse(value)) return false;

  const url = new URL(value);
  const validProtocol = url.protocol === "https:" || url.protocol === "http:";

  return validProtocol && !url.username && !url.password && !value.includes("#");
};
const isEmptySelectedScope = (scope: WebhookScope): boolean => {
  return scope.mode === "selected" && getScopeItems(scope).length === 0;
};
const validateDraft = (draft: WebhookDraft): string => {
  if (!draft.name.trim()) return "Name is required";
  if (!draft.url.trim()) return "URL is required";

  if (!isValidWebhookURL(draft.url.trim())) {
    return "Enter a valid HTTPS URL without credentials or a fragment";
  }

  if (draft.eventTypes.length === 0) return "Select at least one event";
  if (isEmptySelectedScope(draft.collections)) return "Select at least one collection";

  return "";
};
const isScopeNarrowed = (previous: WebhookScope, next: WebhookScope): boolean => {
  if (next.mode === "all") return false;
  if (previous.mode === "all") return true;

  const nextItems = new Set(getScopeItems(next));

  return getScopeItems(previous).some((item) => !nextItems.has(item));
};
const isSelectionNarrowed = (previous: WebhookDraft, next: WebhookDraftChanges): boolean => {
  const eventRemoved = next.eventTypes
    ? previous.eventTypes.some((type) => !next.eventTypes!.includes(type))
    : false;
  const collectionsNarrowed = next.collections
    ? isScopeNarrowed(previous.collections, next.collections)
    : false;
  const channelsNarrowed = next.channels
    ? isScopeNarrowed(previous.channels, next.channels)
    : false;
  const restrictedRemoved = previous.restrictedContent && next.restrictedContent === false;

  return eventRemoved || collectionsNarrowed || channelsNarrowed || restrictedRemoved;
};
const getChangeNotices = (
  webhook: Webhook,
  changes: WebhookDraftChanges
): WebhookChangeNotice[] => {
  const previous = createDraftFromWebhook(webhook);
  const notices: WebhookChangeNotice[] = [];
  const selectionChanged =
    changes.eventTypes !== undefined ||
    changes.collections !== undefined ||
    changes.channels !== undefined ||
    changes.restrictedContent !== undefined;

  if (changes.url !== undefined) {
    notices.push({
      id: "url",
      icon: "i-lucide:link",
      label: `New destination: ${getWebhookHost(changes.url)}`,
      detail:
        "The signing secret is replaced immediately and pending events to the old URL are cancelled. Requests that already started can still reach the old URL."
    });
  }

  if (isSelectionNarrowed(previous, changes)) {
    notices.push({
      id: "selection",
      icon: "i-lucide:list-minus",
      label: "Narrower events or scope",
      detail: "Pending events that no longer match are cancelled."
    });
  }

  if (changes.enabled === false) {
    notices.push({
      id: "disable",
      icon: "i-lucide:pause",
      label: "Disable webhook",
      detail: "Pending events are cancelled and new events are not recorded for it."
    });
  }

  if (selectionChanged || changes.enabled !== undefined) {
    notices.push({
      id: "backfill",
      icon: "i-lucide:history",
      label: "No historical delivery",
      detail: "Changes apply to new events only. Earlier events are not sent."
    });
  }

  return notices;
};

const getSaveErrorMessage = (code: string | undefined, creating: boolean, urlChanged: boolean) => {
  if (code === "FORBIDDEN") {
    return "You cannot approve access to this content. Ask someone with broader access";
  }

  if (code === "BAD_REQUEST") {
    return "The configuration was rejected. Check the URL, events, and selected scope";
  }

  if (creating) return "Failed to create webhook. Check the API settings before trying again";
  if (urlChanged) {
    return "Failed to save webhook. Reload to check the result, and rotate the secret if a new one was lost";
  }

  return "Failed to save webhook. Reload to check whether changes were saved";
};
const trimDraftFields = <T extends Partial<WebhookDraft>>(draft: T): T => ({
  ...draft,
  ...(draft.name !== undefined && { name: draft.name.trim() }),
  ...(draft.url !== undefined && { url: draft.url.trim() })
});

export {
  MAX_SELECTED_SCOPE_ITEMS,
  createDraftFromWebhook,
  createEmptyDraft,
  getChangeNotices,
  getDraftChanges,
  getEffectiveDraft,
  getSaveErrorMessage,
  getScopeItems,
  getWebhookHost,
  trimDraftFields,
  usesChannelFilter,
  validateDraft
};
export type { WebhookChangeNotice, WebhookDraft, WebhookDraftChanges, WebhookScope };
