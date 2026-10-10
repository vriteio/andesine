import { extensionStorageKeyType, extensionStorageListInputType } from "../extensions/storage";
import { publicID } from "../primitives/id";
import { webhookEventNameType } from "../webhooks/events";
import { webhookRunType } from "./schemas/webhook-deliveries";
import * as z from "zod";
import { baseContract, cliContract, extensionContract, sessionContract } from "./base";
import {
  extensionCatalogItemType,
  extensionCatalogDetailsType,
  extensionSummaryType,
  extensionDetailsType,
  extensionRuntimeType,
  extensionActiveViewType,
  extensionElementViewSettingType,
  extensionSelfType,
  extensionSessionType,
  extensionStateResultType,
  extensionDevelopmentUploadType,
  extensionInstallationType,
  extensionConfigurationValuesType,
  extensionConfigurationStateType,
  extensionSelfConfigurationType,
  extensionStorageEntryType,
  extensionStorageWriteType,
  extensionStoragePageType,
  extensionDeliveryType,
  extensionWebhookType,
  extensionWebhookInputType,
  extensionSessionTokenType,
  extensionWebhookDeliveryListInputType,
  extensionWebhookDeliveryListType,
  extensionWebhookDeliveryInputType,
  extensionWebhookDeliveryDetailsType,
  extensionWebhookRunListInputType,
  extensionWebhookRunListType,
  extensionWebhookAttemptListInputType,
  extensionWebhookAttemptListType
} from "./schemas/extensions";

// Extension API operations use extension JWTs; the others are for the web app only.
const extensionsContract = baseContract.prefix("/extensions").router({
  getSelf: extensionContract
    .route({
      summary: "Get the extension",
      description:
        "Returns the installed extension that the token's subject names, including disabled and uninstalled extensions.",
      tags: ["extensions"],
      method: "GET",
      path: "/self"
    })
    .meta({ inactiveExtensions: true })
    .output(extensionSelfType),
  verifySession: extensionContract
    .route({
      summary: "Verify a session token",
      description:
        "Verifies a session token from the extension frontend and returns its member. Tokens of other extensions, expired tokens, and tokens of an earlier extension generation fail with NOT_FOUND.",
      tags: ["extensions"],
      method: "POST",
      path: "/self/sessions/verify"
    })
    .input(z.object({ token: z.string().min(1).max(200) }))
    .output(extensionSessionType),
  listInstallations: extensionContract
    .route({
      summary: "List installations",
      description:
        "Lists the installations of the extension on this instance. Requires an app-level token: an extension JWT without a subject.",
      tags: ["extensions"],
      method: "GET",
      path: "/self/installations"
    })
    .meta({ inactiveExtensions: true })
    .input(
      z.object({
        after: publicID("ext").optional().describe("Return installations after this ID"),
        limit: z.coerce.number().int().min(1).max(100).default(100)
      })
    )
    .output(z.object({ data: z.array(extensionInstallationType), hasMore: z.boolean() })),
  getSelfDelivery: extensionContract
    .route({
      summary: "Get a delivery",
      description:
        "Returns the event of a delivery to one of the extension's webhooks. Disabled and uninstalled extensions can read only lifecycle deliveries.",
      tags: ["extensions"],
      method: "GET",
      path: "/self/deliveries/{deliveryID}"
    })
    .meta({ inactiveExtensions: true })
    .input(z.object({ deliveryID: publicID("whdel") }))
    .output(extensionDeliveryType),
  getSelfConfiguration: extensionContract
    .route({
      summary: "Get the configuration",
      description:
        "Returns the extension's configuration, including secret fields, and its revision. Unset fields use their defaults.",
      tags: ["extensions"],
      method: "GET",
      path: "/self/configuration"
    })
    .output(extensionSelfConfigurationType),
  getSelfStorageEntry: extensionContract
    .route({
      summary: "Get a storage entry",
      description: "Returns an entry of the extension's storage, or NOT_FOUND.",
      tags: ["extensions"],
      method: "GET",
      path: "/self/storage/entry"
    })
    .input(z.object({ key: extensionStorageKeyType }))
    .output(extensionStorageEntryType),
  setSelfStorageEntry: extensionContract
    .route({
      summary: "Set a storage entry",
      description:
        "Creates or replaces an entry of the extension's storage. Values are JSON up to 128 KiB; the storage holds up to 10,000 entries and 10 MiB.",
      tags: ["extensions"],
      method: "PUT",
      path: "/self/storage/entry"
    })
    .input(z.object({ key: extensionStorageKeyType, value: z.json() }))
    .output(extensionStorageWriteType),
  deleteSelfStorageEntry: extensionContract
    .route({
      summary: "Delete a storage entry",
      description: "Deletes an entry of the extension's storage, if it exists.",
      tags: ["extensions"],
      method: "DELETE",
      path: "/self/storage/entry",
      // DELETE bodies are not reliable, so the key is a query parameter.
      inputStructure: "detailed"
    })
    .input(z.object({ query: z.object({ key: extensionStorageKeyType }) }))
    .output(z.object({ deleted: z.boolean() })),
  listSelfStorageEntries: extensionContract
    .route({
      summary: "List storage entries",
      description:
        "Lists the extension's storage entries in key order, optionally with a key prefix. A page ends early when its values reach 192 KiB.",
      tags: ["extensions"],
      method: "GET",
      path: "/self/storage"
    })
    .input(extensionStorageListInputType)
    .output(extensionStoragePageType),
  getStorageEntry: sessionContract
    .route({ method: "GET", path: "/{extensionID}/storage/entry" })
    .input(z.object({ extensionID: publicID("ext"), key: extensionStorageKeyType }))
    .output(extensionStorageEntryType),
  setStorageEntry: sessionContract
    .route({ method: "PUT", path: "/{extensionID}/storage/entry" })
    .input(
      z.object({ extensionID: publicID("ext"), key: extensionStorageKeyType, value: z.json() })
    )
    .output(extensionStorageWriteType),
  deleteStorageEntry: sessionContract
    .route({ method: "DELETE", path: "/{extensionID}/storage/entry" })
    .input(z.object({ extensionID: publicID("ext"), key: extensionStorageKeyType }))
    .output(z.object({ deleted: z.boolean() })),
  listStorageEntries: sessionContract
    .route({ method: "GET", path: "/{extensionID}/storage" })
    .input(extensionStorageListInputType.extend({ extensionID: publicID("ext") }))
    .output(extensionStoragePageType),
  getConfiguration: sessionContract
    .route({ method: "GET", path: "/{extensionID}/configuration" })
    .input(z.object({ extensionID: publicID("ext") }))
    .output(extensionConfigurationStateType),
  setConfiguration: sessionContract
    .route({ method: "PUT", path: "/{extensionID}/configuration" })
    .input(
      z.object({
        extensionID: publicID("ext"),
        values: extensionConfigurationValuesType.describe("All non-secret values"),
        secrets: z
          .record(z.string(), z.string().nullable())
          .optional()
          .describe("Secret fields to set, or null to clear; other secret fields are unchanged"),
        expectedRevision: z.int().positive()
      })
    )
    .output(z.object({ revision: z.int().positive() })),
  listCatalog: sessionContract
    .route({ method: "GET", path: "/catalog" })
    .output(z.array(extensionCatalogItemType)),
  getCatalogItem: sessionContract
    .route({ method: "GET", path: "/catalog/item" })
    .input(z.object({ name: z.string().max(100) }))
    .output(extensionCatalogDetailsType),
  list: sessionContract.route({ method: "GET", path: "/" }).output(z.array(extensionSummaryType)),
  get: sessionContract
    .route({ method: "GET", path: "/{extensionID}" })
    .input(z.object({ extensionID: publicID("ext") }))
    .output(extensionDetailsType),
  listRuntime: sessionContract
    .route({ method: "GET", path: "/runtime" })
    .output(z.array(extensionRuntimeType)),
  install: sessionContract
    .route({ method: "POST", path: "/" })
    .input(
      z.object({
        name: z.string().max(100),
        values: extensionConfigurationValuesType.optional().describe("Initial non-secret values"),
        secrets: z.record(z.string(), z.string()).optional().describe("Initial secret values")
      })
    )
    .output(extensionStateResultType),
  setEnabled: sessionContract
    .route({ method: "PUT", path: "/{extensionID}/enabled" })
    .input(
      z.object({
        extensionID: publicID("ext"),
        enabled: z.boolean(),
        expectedRevision: z.int().positive()
      })
    )
    .output(extensionStateResultType),
  approve: sessionContract
    .route({ method: "POST", path: "/{extensionID}/approve" })
    .input(z.object({ extensionID: publicID("ext"), expectedRevision: z.int().positive() }))
    .output(extensionStateResultType),
  uninstall: sessionContract
    .route({ method: "DELETE", path: "/{extensionID}" })
    .input(z.object({ extensionID: publicID("ext"), expectedRevision: z.int().positive() }))
    .output(extensionStateResultType),
  // Local development (`andesine extensions dev`); NOT_FOUND unless the instance enables it.
  uploadDevelopment: cliContract
    .route({ method: "PUT", path: "/development" })
    .input(extensionDevelopmentUploadType)
    .output(extensionStateResultType),
  stopDevelopment: cliContract
    .route({ method: "POST", path: "/development/{extensionID}/stop" })
    .input(z.object({ extensionID: publicID("ext") }))
    .output(extensionStateResultType),
  removeDevelopment: cliContract
    .route({ method: "DELETE", path: "/development/{extensionID}" })
    .input(z.object({ extensionID: publicID("ext") }))
    .output(extensionStateResultType),
  // Artifact URLs are addressed by their digest, so the browser fetches them without credentials.
  getDevelopmentArtifact: baseContract
    .route({
      method: "GET",
      path: "/development/{extensionID}/artifacts/{sha256}",
      outputStructure: "detailed"
    })
    .input(z.object({ extensionID: publicID("ext"), sha256: z.string().regex(/^[a-f\d]{64}$/) }))
    .output(
      z.object({
        headers: z.object({
          "Cache-Control": z.literal("private, no-store"),
          "X-Content-Type-Options": z.literal("nosniff")
        }),
        body: z.file()
      })
    ),
  listWebhooks: sessionContract
    .route({ method: "GET", path: "/{extensionID}/webhooks" })
    .input(z.object({ extensionID: publicID("ext") }))
    .output(z.array(extensionWebhookType)),
  setWebhookEnabled: sessionContract
    .route({ method: "PUT", path: "/{extensionID}/webhooks/{webhookID}/enabled" })
    .input(
      extensionWebhookInputType.extend({
        enabled: z.boolean(),
        expectedRevision: z.int().positive()
      })
    )
    .output(z.object({ revision: z.int().positive() })),
  redeliverWebhook: sessionContract
    .route({ method: "POST", path: "/{extensionID}/webhooks/{webhookID}/redeliver" })
    .input(
      extensionWebhookInputType.extend({
        deliveryIDs: z.array(publicID("whdel")).min(1).max(100)
      })
    )
    .output(z.array(webhookRunType)),
  sendWebhookTest: cliContract
    .route({ method: "POST", path: "/{extensionID}/webhooks/{webhookID}/test" })
    .input(extensionWebhookInputType.extend({ type: webhookEventNameType }))
    .output(z.object({ deliveryID: publicID("whdel") })),
  listWebhookDeliveries: sessionContract
    .route({ method: "GET", path: "/{extensionID}/webhooks/{webhookID}/deliveries" })
    .input(extensionWebhookDeliveryListInputType)
    .output(extensionWebhookDeliveryListType),
  getWebhookDelivery: cliContract
    .route({ method: "GET", path: "/{extensionID}/webhooks/{webhookID}/deliveries/{deliveryID}" })
    .input(extensionWebhookDeliveryInputType)
    .output(extensionWebhookDeliveryDetailsType),
  listWebhookRuns: sessionContract
    .route({
      method: "GET",
      path: "/{extensionID}/webhooks/{webhookID}/deliveries/{deliveryID}/runs"
    })
    .input(extensionWebhookRunListInputType)
    .output(extensionWebhookRunListType),
  listWebhookAttempts: sessionContract
    .route({
      method: "GET",
      path: "/{extensionID}/webhooks/{webhookID}/deliveries/{deliveryID}/runs/{runID}/attempts"
    })
    .input(extensionWebhookAttemptListInputType)
    .output(extensionWebhookAttemptListType),
  listActiveViews: sessionContract
    .route({ method: "GET", path: "/active-views" })
    .output(z.array(extensionActiveViewType)),
  listElementViews: sessionContract
    .route({ method: "GET", path: "/{extensionID}/element-views" })
    .input(z.object({ extensionID: publicID("ext") }))
    .output(z.array(extensionElementViewSettingType)),
  setElementViewEnabled: sessionContract
    .route({ method: "PUT", path: "/{extensionID}/element-views/{viewID}" })
    .input(
      z.object({
        extensionID: publicID("ext"),
        viewID: z.string().max(64),
        enabled: z.boolean(),
        expectedRevision: z.int().positive()
      })
    )
    .output(z.object({ revision: z.int().positive() })),
  createSessionToken: sessionContract
    .route({ method: "POST", path: "/{extensionID}/session-tokens" })
    .input(z.object({ extensionID: publicID("ext") }))
    .output(extensionSessionTokenType)
});

export { extensionsContract };
export {
  extensionNotificationType,
  extensionSessionTokenType,
  extensionActiveViewType,
  extensionElementViewSettingType
} from "./schemas/extensions";
export type {
  ExtensionWebhookDelivery,
  ExtensionWebhookDeliveryDetails,
  ExtensionSessionToken,
  ExtensionGrant,
  ExtensionVersionDetails,
  ExtensionCatalogItem,
  ExtensionCatalogDetails,
  ExtensionSummary,
  ExtensionDetails,
  ExtensionRuntime,
  ExtensionNotification,
  ExtensionWebhookState,
  ExtensionDelivery,
  ExtensionStorageEntry,
  ExtensionStorageWrite,
  ExtensionStoragePage,
  ExtensionConfigurationState,
  ExtensionSelfConfiguration,
  ExtensionActiveView,
  ExtensionSelf,
  ExtensionStateResult,
  ExtensionSession,
  ExtensionInstallation,
  ExtensionElementViewSetting,
  ExtensionDevelopmentUpload
} from "./schemas/extensions";
