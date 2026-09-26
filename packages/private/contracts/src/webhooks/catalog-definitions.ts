// Plain webhook catalog data shared by the backend and the web app. It has no runtime
// dependencies, so the settings UI can import it instead of requesting the catalog.
interface WebhookEventDefinition {
  label: string;
  description: string;
  category: WebhookEventCategory;
  requiredPermissions: WebhookReadPermission[];
  filters: WebhookEventFilter[];
}

type WebhookEventName = (typeof webhookEventNames)[number];
type WebhookReadPermission = (typeof webhookReadPermissions)[number];
type WebhookEventCategory = (typeof webhookEventCategories)[number]["id"];
type WebhookEventFilter = "collections" | "channels";

const webhookEventNames = [
  "entry.created",
  "entry.updated",
  "entry.content_saved",
  "entry.moved",
  "entry.deleted",
  "entry.restored",
  "collection.created",
  "collection.updated",
  "collection.moved",
  "collection.deleted",
  "collection.restored",
  "publishing.channel_advanced",
  "publishing.channel_created",
  "publishing.channel_deleted"
] as const;
const webhookReadPermissions = ["read:entries", "read:collections", "read:publishing"] as const;
const webhookEventCategories = [
  { id: "entries", label: "Entries" },
  { id: "collections", label: "Collections" },
  { id: "publishing", label: "Publishing" }
] as const;
const webhookEventDefinitions = {
  "entry.created": {
    label: "Entry created",
    description: "An entry and its initial content were saved. Matches the committed collection.",
    category: "entries",
    requiredPermissions: ["read:entries"],
    filters: ["collections"]
  },
  "entry.updated": {
    label: "Entry metadata updated",
    description: "Entry metadata changed. Content and location changes have separate events.",
    category: "entries",
    requiredPermissions: ["read:entries"],
    filters: ["collections"]
  },
  "entry.content_saved": {
    label: "Entry content saved",
    description:
      "Changed content was saved and is available through the API. No-op saves do not qualify.",
    category: "entries",
    requiredPermissions: ["read:entries"],
    filters: ["collections"]
  },
  "entry.moved": {
    label: "Entry moved",
    description:
      "An entry was moved or reordered, directly or with an ancestor. Matches either location; unauthorized location details are hidden.",
    category: "entries",
    requiredPermissions: ["read:entries"],
    filters: ["collections"]
  },
  "entry.deleted": {
    label: "Entry deleted",
    description:
      "An entry was logically deleted. Matches its former collection; physical cleanup emits no event.",
    category: "entries",
    requiredPermissions: ["read:entries"],
    filters: ["collections"]
  },
  "entry.restored": {
    label: "Entry restored",
    description: "A deleted entry was restored. Matches its restored collection.",
    category: "entries",
    requiredPermissions: ["read:entries"],
    filters: ["collections"]
  },
  "collection.created": {
    label: "Collection created",
    description: "A collection was created. A selected subtree includes its root collection.",
    category: "collections",
    requiredPermissions: ["read:collections"],
    filters: ["collections"]
  },
  "collection.updated": {
    label: "Collection updated",
    description:
      "Collection metadata changed. Matches the committed subtree and its current access restrictions.",
    category: "collections",
    requiredPermissions: ["read:collections"],
    filters: ["collections"]
  },
  "collection.moved": {
    label: "Collection moved",
    description:
      "A collection was moved or reordered. Affected descendants have their own events; either location can match.",
    category: "collections",
    requiredPermissions: ["read:collections"],
    filters: ["collections"]
  },
  "collection.deleted": {
    label: "Collection deleted",
    description:
      "A collection was logically deleted. Matches its former subtree; deleted descendants have their own events.",
    category: "collections",
    requiredPermissions: ["read:collections"],
    filters: ["collections"]
  },
  "collection.restored": {
    label: "Collection restored",
    description: "A deleted collection was restored. Matches its restored subtree.",
    category: "collections",
    requiredPermissions: ["read:collections"],
    filters: ["collections"]
  },
  "publishing.channel_advanced": {
    label: "Channel snapshot advanced",
    description:
      "One channel snapshot changed. Matches changes inside the webhook scope in either snapshot, including removals, and the channel filter. Snapshot references do not grant content access.",
    category: "publishing",
    requiredPermissions: ["read:publishing"],
    filters: ["collections", "channels"]
  },
  "publishing.channel_created": {
    label: "Channel created",
    description:
      "A channel and its initial snapshot were created. The collection scope does not apply.",
    category: "publishing",
    requiredPermissions: ["read:publishing"],
    filters: ["channels"]
  },
  "publishing.channel_deleted": {
    label: "Channel deleted",
    description:
      "A channel was deleted. The collection scope does not apply; its final snapshot retains the existing workspace expiry policy.",
    category: "publishing",
    requiredPermissions: ["read:publishing"],
    filters: ["channels"]
  }
} satisfies Record<WebhookEventName, WebhookEventDefinition>;

export {
  webhookEventCategories,
  webhookEventDefinitions,
  webhookEventNames,
  webhookReadPermissions
};
export type {
  WebhookEventCategory,
  WebhookEventDefinition,
  WebhookEventFilter,
  WebhookEventName,
  WebhookReadPermission
};
