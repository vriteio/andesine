import { MAX_BULK_ITEMS } from "../../limits";
import { publicID } from "../../primitives/id";
import { uniqueItems, webhookChannelCodeType, webhookEventNameType } from "../../webhooks/events";
import * as z from "zod";

type WebhookConfiguration = z.infer<typeof webhookConfigurationType>;
type WebhookCreateInput = z.input<typeof webhookCreateInputType>;
type WebhookEndpoint = z.infer<typeof webhookEndpointType>;
type WebhookScope = Pick<WebhookConfiguration, "collections" | "channels" | "restrictedContent">;
type WebhookUpdateInput = z.infer<typeof webhookUpdateInputType>;
type WebhookRevisionInput = z.infer<typeof webhookRevisionInputType>;
type WebhookBulkRevisionInput = z.infer<typeof webhookBulkRevisionInputType>;
type WebhookBulkEnabledInput = z.infer<typeof webhookBulkEnabledInputType>;
type WebhookSecretResult = z.infer<typeof webhookSecretResultType>;
type WebhookUpdateResult = z.infer<typeof webhookUpdateResultType>;

const webhookCollectionScopeType = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("all") }),
  z.strictObject({
    mode: z.literal("selected"),
    roots: z
      .array(publicID("coll"))
      .min(1)
      .max(MAX_BULK_ITEMS)
      .refine(uniqueItems, "Roots must be unique")
  })
]);
const webhookChannelScopeType = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("all") }),
  z.strictObject({
    mode: z.literal("selected"),
    codes: z
      .array(webhookChannelCodeType)
      .min(1)
      .max(MAX_BULK_ITEMS)
      .refine(uniqueItems, "Channels must be unique")
  })
]);
// This checks URL syntax only. Every dispatch still requires server network policy.
// HTTP is representable for explicit self-hosted operator exceptions.
const webhookURLType = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .refine((value) => {
    if (!URL.canParse(value)) return false;

    const url = new URL(value);

    return !url.username && !url.password && !value.includes("#");
  }, "Webhook URLs cannot include credentials or a fragment");
const webhookConfigurationType = z.strictObject({
  name: z.string().trim().min(1).max(100),
  url: webhookURLType,
  enabled: z.boolean(),
  eventTypes: z
    .array(webhookEventNameType)
    .min(1)
    .max(webhookEventNameType.options.length)
    .refine(uniqueItems, "Event types must be unique"),
  schemaVersion: z.literal(1),
  // Selected roots include their subtrees. They are both the event filter and the
  // visibility boundary: locations outside them are never disclosed.
  collections: webhookCollectionScopeType,
  channels: webhookChannelScopeType,
  restrictedContent: z
    .boolean()
    .describe("Include restricted collections, including ones restricted later")
});
const webhookCreateInputType = webhookConfigurationType.extend({
  enabled: z.boolean().default(true)
});
const webhookRevisionInputType = z.strictObject({
  id: publicID("wh"),
  expectedRevision: z.number().int().positive()
});
// A workspace has at most 10 webhooks, so one request covers all of them.
const webhookBulkRevisionInputType = z.strictObject({
  webhooks: z
    .array(webhookRevisionInputType)
    .min(1)
    .max(10)
    .refine((items) => uniqueItems(items.map(({ id }) => id)), "Webhooks must be unique")
});
const webhookBulkEnabledInputType = webhookBulkRevisionInputType.extend({ enabled: z.boolean() });
const webhookUpdateInputType = webhookConfigurationType
  .partial()
  .extend(webhookRevisionInputType.shape)
  .refine(
    (value) => Object.keys(value).some((key) => key !== "id" && key !== "expectedRevision"),
    "Supply at least one configuration change"
  );
const webhookFailureCategoryType = z.enum([
  "http_status",
  "timeout",
  "network",
  "destination_policy",
  "internal"
]);
const webhookEndpointType = webhookConfigurationType.extend({
  id: publicID("wh"),
  workspaceID: publicID("ws"),
  revision: z.number().int().positive(),
  destinationRevision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  disabledReason: z.enum(["manual", "failures"]).nullable(),
  health: z.strictObject({
    consecutiveFailures: z.number().int().nonnegative(),
    firstFailureAt: z.iso.datetime().nullable(),
    lastFailureAt: z.iso.datetime().nullable(),
    lastFailureCategory: webhookFailureCategoryType.nullable(),
    lastSuccessAt: z.iso.datetime().nullable(),
    pendingCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative()
  }),
  signing: z.strictObject({
    rotatedAt: z.iso.datetime(),
    previousSecretExpiresAt: z.iso.datetime().nullable()
  })
});
const webhookSecretType = z
  .string()
  .regex(/^whsec_[A-Za-z\d+/]{43}=$/)
  .describe("One-time signing secret. Never returned by configuration or history reads.");
const webhookSecretResultType = z.strictObject({
  endpoint: webhookEndpointType,
  secret: webhookSecretType
});
const webhookUpdateResultType = z.discriminatedUnion("secretChanged", [
  z.strictObject({ secretChanged: z.literal(false), endpoint: webhookEndpointType }),
  webhookSecretResultType.extend({ secretChanged: z.literal(true) })
]);

export {
  webhookConfigurationType,
  webhookCreateInputType,
  webhookUpdateInputType,
  webhookRevisionInputType,
  webhookBulkRevisionInputType,
  webhookBulkEnabledInputType,
  webhookEndpointType,
  webhookFailureCategoryType,
  webhookSecretResultType,
  webhookUpdateResultType
};
export type {
  WebhookBulkEnabledInput,
  WebhookBulkRevisionInput,
  WebhookConfiguration,
  WebhookCreateInput,
  WebhookEndpoint,
  WebhookScope,
  WebhookUpdateInput,
  WebhookRevisionInput,
  WebhookSecretResult,
  WebhookUpdateResult
};
