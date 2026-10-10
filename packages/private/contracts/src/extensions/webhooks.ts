import * as z from "zod";
import { webhookEventDefinitions, webhookEventNames } from "../webhooks/catalog-definitions";
import { uniqueItems, webhookChannelCodeType } from "../webhooks/events";
import {
  extensionLifecycleEventNames,
  type ExtensionLifecycleEventName
} from "../webhooks/outbound";

type ExtensionWebhookEventName = z.output<typeof extensionWebhookEventNameType>;
type ExtensionWebhook = z.output<typeof extensionWebhookType>;

const MAX_EXTENSION_WEBHOOKS = 10;
const extensionWebhookEventNameType = z.enum([
  ...webhookEventNames,
  ...extensionLifecycleEventNames
]);
const supportsChannels = (event: ExtensionWebhookEventName): boolean => {
  if (event.startsWith("extension.")) return false;

  return webhookEventDefinitions[event as keyof typeof webhookEventDefinitions].filters.some(
    (filter) => {
      return filter === "channels";
    }
  );
};
/** A path appended to the backend URL; segments cannot be empty, `.` or `..`. */
const extensionWebhookPathType = z
  .string()
  .max(200)
  .regex(/^\/(?:[A-Za-z\d_~-][A-Za-z\d._~-]*\/?)*$/, "Use a path, e.g. /webhooks");
const extensionWebhookType = z
  .strictObject({
    events: z
      .array(extensionWebhookEventNameType)
      .min(1)
      .max(extensionWebhookEventNameType.options.length)
      .refine(uniqueItems, "Events must be unique"),
    path: extensionWebhookPathType,
    channels: z
      .array(webhookChannelCodeType)
      .max(50)
      .refine(uniqueItems, "Channels must be unique")
      .describe("Publishing channels to match; empty for all channels")
      .default([])
  })
  .refine(({ events, channels }) => !channels.length || events.some(supportsChannels), {
    message: "Channel filters need an event that supports them",
    path: ["channels"]
  });

export {
  MAX_EXTENSION_WEBHOOKS,
  extensionLifecycleEventNames,
  extensionWebhookEventNameType,
  extensionWebhookType
};
export type { ExtensionLifecycleEventName, ExtensionWebhookEventName, ExtensionWebhook };
