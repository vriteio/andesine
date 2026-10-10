import { publicID } from "../primitives/id";
import * as z from "zod";
import { webhookConfigurationType } from "../api/schemas/webhooks";
import { webhookEventNames } from "./catalog-definitions";
import { uniqueItems, webhookEnvelopeType, webhookEventType, type WebhookEvent } from "./events";

// HTTP webhook events plus extension lifecycle events, which only extension webhooks receive.
type OutboundEvent = z.infer<typeof outboundEventType>;
type OutboundEventName = OutboundEvent["type"];
type OutboundConfiguration = z.infer<typeof outboundConfigurationType>;
type ExtensionLifecycleEventName = (typeof extensionLifecycleEventNames)[number];

/** Delivered only to the webhooks of the extension they describe; they need no permission. */
const extensionLifecycleEventNames = [
  "extension.installed",
  "extension.enabled",
  "extension.disabled",
  "extension.updated",
  "extension.configured",
  "extension.uninstalled"
] as const;
const versionType = z.string().min(1).max(64);
const lifecycleEventType = webhookEnvelopeType.extend({
  subject: z.strictObject({ kind: z.literal("extension"), id: publicID("ext") })
});
const versionDataType = z.strictObject({ version: versionType });
const extensionLifecycleEventSchemas = {
  "extension.installed": lifecycleEventType.extend({
    type: z.literal("extension.installed"),
    data: versionDataType
  }),
  "extension.enabled": lifecycleEventType.extend({
    type: z.literal("extension.enabled"),
    data: versionDataType
  }),
  "extension.disabled": lifecycleEventType.extend({
    type: z.literal("extension.disabled"),
    data: versionDataType.extend({
      reason: z.enum(["manual", "approval_required", "configuration_required", "revoked"])
    })
  }),
  "extension.updated": lifecycleEventType.extend({
    type: z.literal("extension.updated"),
    data: versionDataType.extend({ previousVersion: versionType })
  }),
  "extension.configured": lifecycleEventType.extend({
    type: z.literal("extension.configured"),
    data: versionDataType.extend({
      changedFields: z.array(z.string().max(64)).max(100).describe("Keys only, never values")
    })
  }),
  "extension.uninstalled": lifecycleEventType.extend({
    type: z.literal("extension.uninstalled"),
    data: versionDataType
  })
};
const outboundEventNameType = z.enum([...webhookEventNames, ...extensionLifecycleEventNames]);
const outboundEventType = z.discriminatedUnion("type", [
  ...webhookEventType.options,
  extensionLifecycleEventSchemas["extension.installed"],
  extensionLifecycleEventSchemas["extension.enabled"],
  extensionLifecycleEventSchemas["extension.disabled"],
  extensionLifecycleEventSchemas["extension.updated"],
  extensionLifecycleEventSchemas["extension.configured"],
  extensionLifecycleEventSchemas["extension.uninstalled"]
]);
/** Stored endpoint configuration; only managed extension webhooks select lifecycle events. */
const outboundConfigurationType = webhookConfigurationType.extend({
  eventTypes: z
    .array(outboundEventNameType)
    .min(1)
    .max(outboundEventNameType.options.length)
    .refine(uniqueItems, "Event types must be unique")
});
const isExtensionLifecycleEvent = (type: string): type is ExtensionLifecycleEventName => {
  return (extensionLifecycleEventNames as readonly string[]).includes(type);
};

/** HTTP webhook events, as opposed to extension lifecycle events. */
const isWebhookEvent = (event: OutboundEvent): event is WebhookEvent => {
  return !isExtensionLifecycleEvent(event.type);
};

export {
  isWebhookEvent,
  extensionLifecycleEventNames,
  extensionLifecycleEventSchemas,
  outboundEventNameType,
  outboundEventType,
  outboundConfigurationType,
  isExtensionLifecycleEvent
};
export type {
  ExtensionLifecycleEventName,
  OutboundConfiguration,
  OutboundEvent,
  OutboundEventName
};
