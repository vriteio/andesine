import { publicID } from "#backend/lib/primitives/id";
import { JSON_SCHEMA_REGISTRY } from "@orpc/zod/zod4";
import * as z from "zod";
import { webhookEventNames, webhookReadPermissions } from "./catalog-definitions";

type WebhookEvent = z.infer<typeof webhookEventType>;
type WebhookEventName = WebhookEvent["type"];

// Wire schemas must not load database, configuration, or application services.
// Strict objects reject accidental document, private matching, or destination data.
const webhookChannelCodeType = z.string().min(1).max(50);
const webhookReadPermissionType = z.enum(webhookReadPermissions);
const uniqueItems = <T>(values: T[]): boolean => new Set(values).size === values.length;
const nameType = z.string().min(1).max(300);
const parentType = publicID("coll").nullable();
const contentHashType = z.string().regex(/^[a-f\d]{64}$/);
const entrySubjectType = z.strictObject({ kind: z.literal("entry"), id: publicID("ent") });
const collectionSubjectType = z.strictObject({
  kind: z.literal("collection"),
  id: publicID("coll")
});
const channelSubjectType = z.strictObject({
  kind: z.literal("channel"),
  code: webhookChannelCodeType
});
const envelopeType = z.strictObject({
  id: publicID("whevt"),
  operationID: publicID("whop"),
  schemaVersion: z.literal(1),
  occurredAt: z.iso.datetime(),
  workspaceID: publicID("ws"),
  test: z.boolean()
});
const visibleLocationType = z.strictObject({
  visibility: z.literal("visible"),
  parentID: parentType.describe("Null means the workspace root, never a hidden parent"),
  order: z.string().min(1).max(255).optional()
});
const hiddenLocationType = z.strictObject({ visibility: z.literal("hidden") });
const moveReasonType = z.enum(["direct", "ancestor_moved", "reordered"]);
const moveDataType = z.discriminatedUnion("scopeTransition", [
  z.strictObject({
    scopeTransition: z.literal("within"),
    reason: moveReasonType,
    from: visibleLocationType,
    to: visibleLocationType
  }),
  z.strictObject({
    scopeTransition: z.literal("entered"),
    reason: moveReasonType,
    from: hiddenLocationType,
    to: visibleLocationType
  }),
  z.strictObject({
    scopeTransition: z.literal("left"),
    reason: moveReasonType,
    from: visibleLocationType,
    to: hiddenLocationType
  })
]);
const entryDataType = z.strictObject({ name: nameType, collectionID: parentType });
const collectionDataType = z.strictObject({ name: nameType, parentID: parentType });
const entryEventType = envelopeType.extend({ subject: entrySubjectType });
const collectionEventType = envelopeType.extend({ subject: collectionSubjectType });
const channelEventType = envelopeType.extend({ subject: channelSubjectType });
const webhookEventSchemas = {
  "entry.created": entryEventType.extend({
    type: z.literal("entry.created"),
    data: entryDataType.extend({ contentHash: contentHashType.optional() })
  }),
  "entry.updated": entryEventType.extend({
    type: z.literal("entry.updated"),
    data: z.strictObject({
      collectionID: parentType,
      changedFields: z.array(z.literal("name")).length(1)
    })
  }),
  "entry.content_saved": entryEventType.extend({
    type: z.literal("entry.content_saved"),
    data: z.strictObject({
      collectionID: parentType,
      contentHash: contentHashType,
      savedAt: z.iso.datetime()
    })
  }),
  "entry.moved": entryEventType.extend({ type: z.literal("entry.moved"), data: moveDataType }),
  "entry.deleted": entryEventType.extend({
    type: z.literal("entry.deleted"),
    data: entryDataType.extend({ deletedAt: z.iso.datetime() })
  }),
  "entry.restored": entryEventType.extend({
    type: z.literal("entry.restored"),
    data: entryDataType
  }),
  "collection.created": collectionEventType.extend({
    type: z.literal("collection.created"),
    data: collectionDataType
  }),
  "collection.updated": collectionEventType.extend({
    type: z.literal("collection.updated"),
    data: z.strictObject({
      parentID: parentType,
      changedFields: z
        .array(z.enum(["name", "restricted", "publishingEnabled"]))
        .min(1)
        .max(3)
        .refine(uniqueItems, "Changed fields must be unique")
        .register(JSON_SCHEMA_REGISTRY, { uniqueItems: true })
    })
  }),
  "collection.moved": collectionEventType.extend({
    type: z.literal("collection.moved"),
    data: moveDataType
  }),
  "collection.deleted": collectionEventType.extend({
    type: z.literal("collection.deleted"),
    data: collectionDataType.extend({ deletedAt: z.iso.datetime() })
  }),
  "collection.restored": collectionEventType.extend({
    type: z.literal("collection.restored"),
    data: collectionDataType
  }),
  "publishing.channel_advanced": channelEventType.extend({
    type: z.literal("publishing.channel_advanced"),
    data: z.strictObject({
      previousSnapshotID: publicID("snp"),
      snapshotID: publicID("snp"),
      reason: z.enum(["publish", "unpublish"])
    })
  }),
  "publishing.channel_created": channelEventType.extend({
    type: z.literal("publishing.channel_created"),
    data: z.strictObject({
      name: z.string().min(1).max(50),
      builtIn: z.boolean(),
      snapshotID: publicID("snp")
    })
  }),
  "publishing.channel_deleted": channelEventType.extend({
    type: z.literal("publishing.channel_deleted"),
    data: z.strictObject({ name: z.string().min(1).max(50), snapshotID: publicID("snp") })
  })
};
const webhookEventNameType = z.enum(webhookEventNames);
const webhookEventType = z.discriminatedUnion("type", [
  webhookEventSchemas["entry.created"],
  webhookEventSchemas["entry.updated"],
  webhookEventSchemas["entry.content_saved"],
  webhookEventSchemas["entry.moved"],
  webhookEventSchemas["entry.deleted"],
  webhookEventSchemas["entry.restored"],
  webhookEventSchemas["collection.created"],
  webhookEventSchemas["collection.updated"],
  webhookEventSchemas["collection.moved"],
  webhookEventSchemas["collection.deleted"],
  webhookEventSchemas["collection.restored"],
  webhookEventSchemas["publishing.channel_advanced"],
  webhookEventSchemas["publishing.channel_created"],
  webhookEventSchemas["publishing.channel_deleted"]
]);

export {
  webhookChannelCodeType,
  webhookReadPermissionType,
  webhookEventSchemas,
  webhookEventNameType,
  webhookEventType,
  uniqueItems
};
export type { WebhookEvent, WebhookEventName };
