import { publicID } from "#backend/lib/primitives/id";
import { uniqueItems, webhookEventNameType, webhookEventType } from "#backend/lib/webhooks/events";
import * as z from "zod";
import { pageInputType, paginationType } from "./pagination";
import { webhookFailureCategoryType, webhookRevisionInputType } from "./webhooks";

type WebhookDeliveryInput = z.infer<typeof webhookDeliveryInputType>;
type WebhookDeliveryListInput = z.input<typeof webhookDeliveryListInputType>;
type WebhookRunListInput = z.input<typeof webhookRunListInputType>;
type WebhookAttemptListInput = z.input<typeof webhookAttemptListInputType>;
type WebhookTestInput = z.infer<typeof webhookTestInputType>;
type WebhookRedeliveryInput = z.infer<typeof webhookRedeliveryInputType>;
type WebhookBulkRedeliveryInput = z.infer<typeof webhookBulkRedeliveryInputType>;
type WebhookDelivery = z.infer<typeof webhookDeliveryType>;
type WebhookDeliveryDetails = z.infer<typeof webhookDeliveryDetailsType>;
type WebhookRun = z.infer<typeof webhookRunType>;
type WebhookAttempt = z.infer<typeof webhookAttemptType>;

const webhookDeliveryStateType = z.enum([
  "pending",
  "in_flight",
  "succeeded",
  "failed",
  "cancelled"
]);
const webhookDeliveryInputType = z.strictObject({
  id: publicID("wh"),
  deliveryID: publicID("whdel")
});
const webhookDeliveryListInputType = pageInputType
  .extend({
    cursor: publicID("whdel").optional(),
    id: publicID("wh"),
    type: webhookEventNameType.optional(),
    state: webhookDeliveryStateType.optional(),
    createdAfter: z.iso.datetime().optional(),
    createdBefore: z.iso.datetime().optional()
  })
  .refine(
    ({ createdAfter, createdBefore }) =>
      !createdAfter || !createdBefore || Date.parse(createdAfter) < Date.parse(createdBefore),
    "createdAfter must precede createdBefore"
  );
const webhookDeliveryType = z.strictObject({
  id: publicID("whdel"),
  endpointID: publicID("wh"),
  eventID: publicID("whevt"),
  type: webhookEventNameType,
  occurredAt: z.iso.datetime(),
  test: z.boolean(),
  state: webhookDeliveryStateType,
  selectedRevision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  retentionDays: z.number().int().positive(),
  attemptCount: z.number().int().nonnegative(),
  currentRunID: publicID("whrun").nullable(),
  nextAttemptAt: z.iso.datetime().nullable(),
  lastHTTPStatus: z.number().int().min(100).max(599).nullable(),
  lastFailureCategory: webhookFailureCategoryType.nullable()
});
const webhookRunType = z.strictObject({
  id: publicID("whrun"),
  deliveryID: publicID("whdel"),
  number: z.number().int().positive(),
  trigger: z.enum(["automatic", "manual", "test"]),
  destinationRevision: z.number().int().positive(),
  state: webhookDeliveryStateType,
  createdAt: z.iso.datetime(),
  deadlineAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  nextAttemptAt: z.iso.datetime().nullable(),
  attemptCount: z.number().int().nonnegative(),
  stopReason: z
    .enum([
      "retry_exhausted",
      "expired",
      "disabled",
      "endpoint_deleted",
      "destination_changed",
      "selection_changed",
      "access_revoked",
      "destination_policy",
      "test_completed"
    ])
    .nullable()
});
const webhookAttemptType = z.strictObject({
  id: publicID("whatt"),
  runID: publicID("whrun"),
  number: z.number().int().positive(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  outcome: z.enum(["in_flight", "succeeded", "failed", "unknown"]),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  failureCategory: webhookFailureCategoryType.nullable(),
  lateResult: z
    .strictObject({
      receivedAt: z.iso.datetime(),
      outcome: z.enum(["succeeded", "receiver_failure", "platform_failure"]),
      durationMs: z.number().int().nonnegative(),
      httpStatus: z.number().int().min(100).max(599).nullable(),
      failureCategory: webhookFailureCategoryType.nullable()
    })
    .nullable()
});
// No raw exception text, receiver response, headers, signatures, or resource IDs in logs.
// Resource references are available only through the separately authorized payload.
const webhookPayloadType = z.discriminatedUnion("availability", [
  z.strictObject({ availability: z.literal("available"), event: webhookEventType }),
  z.strictObject({ availability: z.literal("forbidden") })
]);
const webhookDeliveryDetailsType = z.strictObject({
  delivery: webhookDeliveryType,
  payload: webhookPayloadType,
  currentRun: webhookRunType.nullable()
});
const webhookRunListInputType = pageInputType.extend({
  ...webhookDeliveryInputType.shape,
  cursor: publicID("whrun").optional()
});
const webhookAttemptListInputType = webhookRunListInputType.extend({
  runID: publicID("whrun"),
  cursor: publicID("whatt").optional()
});
const webhookTestInputType = webhookRevisionInputType.extend({ type: webhookEventNameType });
const webhookRedeliveryInputType = webhookDeliveryInputType.extend({
  expectedDestinationRevision: z.number().int().positive()
});
// Matches the delivery page size, so a whole page can be replayed at once.
const webhookBulkRedeliveryInputType = z.strictObject({
  id: publicID("wh"),
  expectedDestinationRevision: z.number().int().positive(),
  deliveryIDs: z
    .array(publicID("whdel"))
    .min(1)
    .max(25)
    .refine(uniqueItems, "Deliveries must be unique")
});
const webhookDeliveryListType = z.strictObject({
  data: z.array(webhookDeliveryType),
  pagination: paginationType
});
const webhookRunListType = z.strictObject({
  data: z.array(webhookRunType),
  pagination: paginationType
});
const webhookBulkRunType = z.strictObject({ data: z.array(webhookRunType) });
const webhookAttemptListType = z.strictObject({
  data: z.array(webhookAttemptType),
  pagination: paginationType
});

export {
  webhookDeliveryInputType,
  webhookDeliveryListInputType,
  webhookDeliveryType,
  webhookRunType,
  webhookAttemptType,
  webhookDeliveryDetailsType,
  webhookDeliveryListType,
  webhookRunListInputType,
  webhookAttemptListInputType,
  webhookRunListType,
  webhookAttemptListType,
  webhookTestInputType,
  webhookRedeliveryInputType,
  webhookBulkRedeliveryInputType,
  webhookBulkRunType
};
export type {
  WebhookDeliveryInput,
  WebhookDeliveryListInput,
  WebhookRunListInput,
  WebhookAttemptListInput,
  WebhookTestInput,
  WebhookRedeliveryInput,
  WebhookBulkRedeliveryInput,
  WebhookDelivery,
  WebhookDeliveryDetails,
  WebhookRun,
  WebhookAttempt
};
