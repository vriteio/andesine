import { publicID } from "#backend/lib/primitives/id";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";
import {
  webhookReadRequirements,
  webhookManageRequirements
} from "#backend/lib/webhooks/permission-requirements";
import { pageInputType, paginationType } from "./schemas/pagination";
import {
  webhookCreateInputType,
  webhookUpdateInputType,
  webhookRevisionInputType,
  webhookBulkRevisionInputType,
  webhookBulkEnabledInputType,
  webhookEndpointType,
  webhookSecretResultType,
  webhookUpdateResultType
} from "./schemas/webhooks";
import {
  webhookDeliveryInputType,
  webhookDeliveryListInputType,
  webhookRunType,
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
} from "./schemas/webhook-deliveries";

// Service checks must also authorize the scope, payload, and destination operations.
const webhooksContract = baseContract.prefix("/webhooks").router({
  list: authenticatedContract
    .meta({ required: webhookReadRequirements })
    .route({ method: "GET", path: "/", tags: ["webhooks"], summary: "List webhooks" })
    .input(pageInputType)
    .output(z.strictObject({ data: z.array(webhookEndpointType), pagination: paginationType })),
  get: authenticatedContract
    .meta({ required: webhookReadRequirements })
    .route({ method: "GET", path: "/{id}", tags: ["webhooks"], summary: "Get a webhook" })
    .input(z.strictObject({ id: publicID("wh") }))
    .output(webhookEndpointType),
  create: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "POST",
      path: "/",
      tags: ["webhooks"],
      summary: "Create a webhook",
      description:
        "Creates an enabled webhook unless `enabled` is false and returns the signing secret once. The caller must be able to read every resource type its events send, and restricted content when included."
    })
    .input(webhookCreateInputType)
    .output(webhookSecretResultType),
  update: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "PUT",
      path: "/{id}",
      tags: ["webhooks"],
      summary: "Update a webhook",
      description:
        "Checks expectedRevision and validates the merged configuration. A URL change cancels pending deliveries and returns a replacement secret once. Scope changes require authority over the previous and new scope."
    })
    .input(webhookUpdateInputType)
    .output(webhookUpdateResultType),
  delete: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "DELETE",
      path: "/{id}",
      tags: ["webhooks"],
      summary: "Delete a webhook",
      description:
        "Cancels pending deliveries and destroys signing keys. Retains history until its original expiry; a deleted endpoint cannot be replayed."
    })
    .input(webhookRevisionInputType)
    .output(z.void()),
  bulkSetEnabled: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "POST",
      path: "/bulk/set-enabled",
      tags: ["webhooks"],
      summary: "Enable or disable webhooks",
      description:
        "Applies the state to every listed webhook in one transaction, checking each expectedRevision. Enabling checks the scope authority and destination of each webhook. Webhooks already in the state are unchanged."
    })
    .input(webhookBulkEnabledInputType)
    .output(z.strictObject({ data: z.array(webhookEndpointType) })),
  bulkDelete: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "POST",
      path: "/bulk/delete",
      tags: ["webhooks"],
      summary: "Delete webhooks",
      description:
        "Deletes every listed webhook in one transaction, checking each expectedRevision. Each deletion cancels pending deliveries and destroys signing keys; history stays until its original expiry."
    })
    .input(webhookBulkRevisionInputType)
    .output(z.void()),
  rotateSecret: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "POST",
      path: "/{id}/rotate-secret",
      tags: ["webhooks"],
      summary: "Rotate a webhook secret",
      description:
        "Returns a new secret once. Overlap keeps the old secret valid for 24 hours. Immediate rotation retires it at once. Normal rotation conflicts while a previous overlap remains active."
    })
    .input(webhookRevisionInputType.extend({ mode: z.enum(["overlap", "immediate"]) }))
    .output(webhookSecretResultType),
  sendTest: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "POST",
      path: "/{id}/test",
      tags: ["webhooks"],
      summary: "Send a webhook test",
      description:
        "Schedules one signed synthetic attempt for this endpoint, including when disabled. The event must be selected by the endpoint. It does not enable the endpoint or change content."
    })
    .input(webhookTestInputType)
    .output(z.strictObject({ deliveryID: publicID("whdel") })),
  listDeliveries: authenticatedContract
    .meta({ required: webhookReadRequirements })
    .route({
      method: "GET",
      path: "/{id}/deliveries",
      tags: ["webhooks"],
      summary: "List webhook deliveries",
      description:
        "Returns unexpired history, including for a deleted endpoint. Metadata does not include event payloads."
    })
    .input(webhookDeliveryListInputType)
    .output(webhookDeliveryListType),
  getDelivery: authenticatedContract
    .meta({ required: webhookReadRequirements })
    .route({
      method: "GET",
      path: "/{id}/deliveries/{deliveryID}",
      tags: ["webhooks"],
      summary: "Get a webhook delivery",
      description:
        "Returns retained delivery metadata and, with content authority, the immutable event payload. Expired deliveries return not found even before physical cleanup."
    })
    .input(webhookDeliveryInputType)
    .output(webhookDeliveryDetailsType),
  listRuns: authenticatedContract
    .meta({ required: webhookReadRequirements })
    .route({
      method: "GET",
      path: "/{id}/deliveries/{deliveryID}/runs",
      tags: ["webhooks"],
      summary: "List delivery runs"
    })
    .input(webhookRunListInputType)
    .output(webhookRunListType),
  listAttempts: authenticatedContract
    .meta({ required: webhookReadRequirements })
    .route({
      method: "GET",
      path: "/{id}/deliveries/{deliveryID}/runs/{runID}/attempts",
      tags: ["webhooks"],
      summary: "List delivery attempts"
    })
    .input(webhookAttemptListInputType)
    .output(webhookAttemptListType),
  redeliver: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "POST",
      path: "/{id}/deliveries/{deliveryID}/redeliver",
      tags: ["webhooks"],
      summary: "Redeliver a webhook event",
      description:
        "Checks the reviewed destination revision and current scope authority. Reuses the original event ID, payload, and expiry. Returns a conflict if a run is active, or the endpoint is disabled or deleted."
    })
    .input(webhookRedeliveryInputType)
    .output(webhookRunType),
  bulkRedeliver: authenticatedContract
    .meta({ required: webhookManageRequirements })
    .route({
      method: "POST",
      path: "/{id}/deliveries/bulk/redeliver",
      tags: ["webhooks"],
      summary: "Redeliver webhook events",
      description:
        "Replays every listed delivery in one transaction with the same checks as a single redelivery. Any ineligible delivery fails the whole request. Counts as one request for rate limiting."
    })
    .input(webhookBulkRedeliveryInputType)
    .output(webhookBulkRunType)
});

export { webhooksContract };
