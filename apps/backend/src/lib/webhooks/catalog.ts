import { webhookEventSchemas, type WebhookEvent, type WebhookEventName } from "./events";
import { webhookEventDefinitions, type WebhookEventDefinition } from "./catalog-definitions";

// Adds the synthetic sample used by discovery and test deliveries to each shared definition.
interface WebhookCatalogEntry<Name extends WebhookEventName> extends WebhookEventDefinition {
  sample: Extract<WebhookEvent, { type: Name }>;
}

const sampleEnvelope = {
  id: "whevt_example",
  operationID: "whop_example",
  schemaVersion: 1,
  occurredAt: "2026-09-25T12:00:00.000Z",
  workspaceID: "ws_example",
  test: true
} as const;
const entrySubject = { kind: "entry", id: "ent_example" } as const;
const collectionSubject = { kind: "collection", id: "coll_example" } as const;
const channelSubject = { kind: "channel", code: "published" } as const;
const sampleMove = {
  scopeTransition: "within",
  reason: "direct",
  from: { visibility: "visible", parentID: "coll_before" },
  to: { visibility: "visible", parentID: "coll_after" }
} as const;
const webhookCatalog = {
  "entry.created": {
    ...webhookEventDefinitions["entry.created"],
    sample: {
      ...sampleEnvelope,
      type: "entry.created",
      subject: entrySubject,
      data: { name: "Getting started", collectionID: "coll_example" }
    }
  },
  "entry.updated": {
    ...webhookEventDefinitions["entry.updated"],
    sample: {
      ...sampleEnvelope,
      type: "entry.updated",
      subject: entrySubject,
      data: { collectionID: "coll_example", changedFields: ["name"] }
    }
  },
  "entry.content_saved": {
    ...webhookEventDefinitions["entry.content_saved"],
    sample: {
      ...sampleEnvelope,
      type: "entry.content_saved",
      subject: entrySubject,
      data: {
        collectionID: "coll_example",
        contentHash: "a".repeat(64),
        savedAt: sampleEnvelope.occurredAt
      }
    }
  },
  "entry.moved": {
    ...webhookEventDefinitions["entry.moved"],
    sample: { ...sampleEnvelope, type: "entry.moved", subject: entrySubject, data: sampleMove }
  },
  "entry.deleted": {
    ...webhookEventDefinitions["entry.deleted"],
    sample: {
      ...sampleEnvelope,
      type: "entry.deleted",
      subject: entrySubject,
      data: {
        name: "Getting started",
        collectionID: "coll_example",
        deletedAt: sampleEnvelope.occurredAt
      }
    }
  },
  "entry.restored": {
    ...webhookEventDefinitions["entry.restored"],
    sample: {
      ...sampleEnvelope,
      type: "entry.restored",
      subject: entrySubject,
      data: { name: "Getting started", collectionID: "coll_example" }
    }
  },
  "collection.created": {
    ...webhookEventDefinitions["collection.created"],
    sample: {
      ...sampleEnvelope,
      type: "collection.created",
      subject: collectionSubject,
      data: { name: "Guides", parentID: "coll_parent" }
    }
  },
  "collection.updated": {
    ...webhookEventDefinitions["collection.updated"],
    sample: {
      ...sampleEnvelope,
      type: "collection.updated",
      subject: collectionSubject,
      data: { parentID: "coll_parent", changedFields: ["name"] }
    }
  },
  "collection.moved": {
    ...webhookEventDefinitions["collection.moved"],
    sample: {
      ...sampleEnvelope,
      type: "collection.moved",
      subject: collectionSubject,
      data: sampleMove
    }
  },
  "collection.deleted": {
    ...webhookEventDefinitions["collection.deleted"],
    sample: {
      ...sampleEnvelope,
      type: "collection.deleted",
      subject: collectionSubject,
      data: { name: "Guides", parentID: "coll_parent", deletedAt: sampleEnvelope.occurredAt }
    }
  },
  "collection.restored": {
    ...webhookEventDefinitions["collection.restored"],
    sample: {
      ...sampleEnvelope,
      type: "collection.restored",
      subject: collectionSubject,
      data: { name: "Guides", parentID: "coll_parent" }
    }
  },
  "publishing.channel_advanced": {
    ...webhookEventDefinitions["publishing.channel_advanced"],
    sample: {
      ...sampleEnvelope,
      type: "publishing.channel_advanced",
      subject: channelSubject,
      data: { previousSnapshotID: "snp_before", snapshotID: "snp_after", reason: "publish" }
    }
  },
  "publishing.channel_created": {
    ...webhookEventDefinitions["publishing.channel_created"],
    sample: {
      ...sampleEnvelope,
      type: "publishing.channel_created",
      subject: channelSubject,
      data: { name: "Published", builtIn: true, snapshotID: "snp_example" }
    }
  },
  "publishing.channel_deleted": {
    ...webhookEventDefinitions["publishing.channel_deleted"],
    sample: {
      ...sampleEnvelope,
      type: "publishing.channel_deleted",
      subject: { kind: "channel", code: "staging" },
      data: { name: "Staging", snapshotID: "snp_example" }
    }
  }
} satisfies { [Name in WebhookEventName]: WebhookCatalogEntry<Name> };
const getWebhookEventSchema = (type: WebhookEventName) => webhookEventSchemas[type];

export { webhookCatalog, getWebhookEventSchema };
