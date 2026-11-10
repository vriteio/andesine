import { extensionConfigurationFieldsType } from "../../extensions/configuration";
import { extensionElementPropFieldsType } from "../../extensions/element-props";
import {
  extensionBlockActionType,
  extensionElementAcceptsType,
  extensionElementViewType,
  extensionPageType,
  extensionPanelType
} from "../../extensions/contributions";
import {
  developmentExtensionManifestType,
  extensionPermissionType
} from "../../extensions/manifest";
import {
  MAX_EXTENSION_ARTIFACT_SIZE,
  extensionArtifactType,
  extensionDisabledReasonType
} from "../../extensions/registry";
import { keyOriginType, keyType } from "../../entities/keys";
import { collectionActionType, entryActionType } from "../../permissions/actions";
import { publicID } from "../../primitives/id";
import { outboundEventNameType, outboundEventType } from "../../webhooks/outbound";
import { paginationType } from "./pagination";
import { webhookAttemptType, webhookDeliveryType, webhookRunType } from "./webhook-deliveries";
import { webhookEndpointType } from "./webhooks";
import * as z from "zod";

type ExtensionSessionToken = z.infer<typeof extensionSessionTokenType>;
type ExtensionGrant = z.infer<typeof extensionGrantType>;
type ExtensionVersionDetails = z.infer<typeof extensionVersionDetailsType>;
type ExtensionCatalogItem = z.infer<typeof extensionCatalogItemType>;
type ExtensionCatalogDetails = z.infer<typeof extensionCatalogDetailsType>;
type ExtensionSummary = z.infer<typeof extensionSummaryType>;
type ExtensionDetails = z.infer<typeof extensionDetailsType>;
type ExtensionRuntime = z.infer<typeof extensionRuntimeType>;
type ExtensionElement = z.infer<typeof extensionElementType>;
type ExtensionNotification = z.infer<typeof extensionNotificationType>;
type ExtensionWebhook = z.infer<typeof extensionWebhookType>;
type ExtensionDelivery = z.infer<typeof extensionDeliveryType>;
type ExtensionWebhookDelivery = z.infer<typeof extensionWebhookDeliveryType>;
type ExtensionWebhookDeliveryDetails = z.infer<typeof extensionWebhookDeliveryDetailsType>;
type ExtensionStorageEntry = z.infer<typeof extensionStorageEntryType>;
type ExtensionStorageWrite = z.infer<typeof extensionStorageWriteType>;
type ExtensionStoragePage = z.infer<typeof extensionStoragePageType>;
type ExtensionConfigurationState = z.infer<typeof extensionConfigurationStateType>;
type ExtensionSelfConfiguration = z.infer<typeof extensionSelfConfigurationType>;
type ExtensionActiveView = z.infer<typeof extensionActiveViewType>;
type ExtensionSelf = z.infer<typeof extensionSelfType>;
type ExtensionStateResult = z.infer<typeof extensionStateResultType>;
type ExtensionSession = z.infer<typeof extensionSessionType>;
type ExtensionSessionCheck = z.infer<typeof extensionSessionCheckType>;
type ExtensionPublishableKey = z.infer<typeof extensionPublishableKeyType>;
type ExtensionInstallation = z.infer<typeof extensionInstallationType>;
type ExtensionElementViewSetting = z.infer<typeof extensionElementViewSettingType>;
type ExtensionDevelopmentUpload = z.infer<typeof extensionDevelopmentUploadType>;

// Development artifacts come from the local instance, which can use HTTP.
const extensionServedArtifactType = extensionArtifactType.extend({
  url: z.url({ protocol: /^https?$/ })
});
const extensionGrantType = z.object({
  permissions: z.array(extensionPermissionType),
  backendURL: z.string().nullable().describe("Receives webhooks and frontend backend requests"),
  requests: z.array(z.string()).describe("URLs that the frontend can request")
});
const extensionPresentationType = z.object({
  name: z.string().describe("Registry name"),
  version: z.string(),
  displayName: z.string(),
  description: z.string(),
  icon: z.string().nullable().describe("Icon class; render it with the icon styles"),
  iconStyles: extensionServedArtifactType.nullable().describe("The version's manifest icon CSS")
});
const extensionVersionDetailsType = extensionPresentationType.extend({
  publishedAt: z.iso.datetime(),
  sourceCommit: z.string(),
  grant: extensionGrantType,
  webhooks: z.array(
    z.object({ webhookID: z.string(), events: z.array(outboundEventNameType), path: z.string() })
  ),
  elementViews: z.array(extensionElementViewType),
  blockActions: z.array(extensionBlockActionType),
  panels: z.array(extensionPanelType),
  pages: z.array(extensionPageType),
  configuration: extensionConfigurationFieldsType.nullable()
});
const extensionCatalogItemType = extensionPresentationType.extend({
  installed: z
    .object({ id: publicID("ext"), state: z.enum(["active", "disabled"]) })
    .nullable()
    .describe("The workspace's installation, if any")
});
const extensionCatalogDetailsType = extensionVersionDetailsType.extend({
  installed: extensionCatalogItemType.shape.installed
});
const extensionSummaryType = extensionPresentationType.extend({
  id: publicID("ext"),
  state: z.enum(["active", "disabled"]),
  disabledReason: extensionDisabledReasonType.nullable(),
  revision: z.int().positive(),
  development: z.boolean()
});
const extensionDetailsType = extensionSummaryType.extend({
  grant: extensionGrantType.describe("The approved grant"),
  pendingGrant: extensionGrantType
    .nullable()
    .describe("The active version's grant while it waits for approval"),
  details: extensionVersionDetailsType.describe("The active version")
});
const extensionRuntimeType = z.object({
  id: publicID("ext"),
  name: z.string(),
  /** For menus that group the extension's pages, with its icon. */
  displayName: z.string(),
  icon: z.string().nullable(),
  version: z.string(),
  generation: z.int().positive(),
  grant: extensionGrantType,
  artifacts: z.object({
    frontend: extensionServedArtifactType,
    styles: extensionServedArtifactType.nullable(),
    icons: extensionServedArtifactType.nullable()
  }),
  elementViews: z.array(extensionElementViewType),
  blockActions: z.array(extensionBlockActionType),
  panels: z.array(extensionPanelType),
  pages: z.array(extensionPageType)
});
const extensionActiveViewType = z.object({
  selector: z.string().describe("The lowercase root element name"),
  extensionID: publicID("ext"),
  viewID: z.string()
});
const extensionElementChildType = z.object({
  element: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  content: z.boolean().describe("False for an element without content, written as <Name />"),
  accepts: extensionElementAcceptsType.describe(
    "The direct child blocks that its content accepts; without it, any blocks"
  ),
  rejects: extensionElementAcceptsType.describe(
    "The direct child blocks that its content doesn't accept, even if `accepts` lists them"
  ),
  props: extensionElementPropFieldsType
    .optional()
    .describe("The props, with their defaults, which a new element gets")
});
const extensionElementType = extensionElementChildType.extend({
  name: z.string(),
  extension: z.string().describe("The extension that renders it, e.g. andesine/pages"),
  children: z
    .array(extensionElementChildType)
    .describe("Elements that belong inside this one, e.g. Tab in Tabs")
});
const extensionElementViewSettingType = z.object({
  viewID: z.string(),
  name: z.string(),
  element: z.string(),
  enabled: z.boolean().describe("The manager's choice"),
  active: z
    .boolean()
    .describe("The view renders: chosen, the extension is enabled, and it has the element"),
  provider: z
    .object({ extensionID: publicID("ext"), name: z.string() })
    .nullable()
    .describe("Another extension whose view is active for the element")
});
const extensionStateType = z
  .enum(["active", "disabled", "uninstalled"])
  .describe("Uninstalled extensions remain readable until their last lifecycle event expires");
const workspacePlanType = z
  .string()
  .describe(
    "The workspace's effective plan, e.g. free or pro; pro when the instance has no billing"
  );
const extensionSelfType = z.object({
  id: publicID("ext").describe("ID of the installed extension"),
  name: z.string().describe("Registry name"),
  version: z.string().describe("Active version"),
  workspaceID: publicID("ws"),
  workspacePlan: workspacePlanType,
  state: extensionStateType,
  disabledReason: extensionDisabledReasonType
    .nullable()
    .describe("Why the extension is disabled; null when it is active or uninstalled")
});
const MAX_PUBLISHABLE_KEY_SCOPE = 20;
const extensionPublishableKeyType = keyType
  .pick({
    id: true,
    name: true,
    permissions: true,
    collectionIDs: true,
    allowedOrigins: true,
    createdAt: true,
    updatedAt: true
  })
  .extend({ value: z.string().describe("The raw key, which is public") });
const extensionPublishableKeyFieldsType = z.object({
  name: z.string().trim().min(1).max(100).describe("A name shown in API settings"),
  collectionIDs: z
    .array(publicID("coll"))
    .min(1)
    .max(MAX_PUBLISHABLE_KEY_SCOPE)
    .describe("Collections, with their descendants, that the key can read"),
  allowedOrigins: z
    .array(keyOriginType)
    .min(1)
    .max(MAX_PUBLISHABLE_KEY_SCOPE)
    .describe("Browser origins that can use the key, besides localhost"),
  answers: z
    .boolean()
    .describe("Whether the key can ask for AI answers; needs the extension's ai-answers permission")
});
const extensionSessionActionType = z.union([collectionActionType, entryActionType]);
const extensionSessionCheckType = z.object({
  collectionID: publicID("coll").nullable().describe("Collection to check; null for the top level"),
  actions: z
    .array(extensionSessionActionType)
    .min(1)
    .max(12)
    .describe("Collection and entry actions that the member must be able to take")
});
const extensionSessionType = z.object({
  workspaceID: publicID("ws"),
  workspacePlan: workspacePlanType,
  version: z.string().describe("The extension version the session was issued for"),
  member: z.object({
    id: z.string().describe("ID of the membership"),
    userID: z.string().describe("ID of the user"),
    profile: z.object({
      id: z.string(),
      name: z.string().optional(),
      image: z.string().optional(),
      email: z.string().optional().describe("Only with the read:memberships permission")
    })
  }),
  checks: z
    .array(
      z.object({
        collectionID: publicID("coll").nullable(),
        allowed: z.boolean().describe("Whether the member and the extension can take every action"),
        denied: z.array(extensionSessionActionType).describe("Actions that are not allowed")
      })
    )
    .describe("Results of the requested checks, in their order")
});
const extensionStateResultType = z.object({
  id: publicID("ext"),
  state: extensionStateType,
  disabledReason: extensionDisabledReasonType.nullable(),
  revision: z.int().positive()
});
const artifactContentType = z.string().max(MAX_EXTENSION_ARTIFACT_SIZE);
/** A build of `andesine extensions dev`; its backend keys are the development keys. */
const extensionDevelopmentUploadType = z.object({
  manifest: developmentExtensionManifestType,
  artifacts: z.object({
    frontend: artifactContentType.min(1),
    styles: artifactContentType.optional(),
    icons: artifactContentType.optional()
  })
});
const extensionInstallationType = z.object({
  id: publicID("ext"),
  workspaceID: publicID("ws"),
  version: z.string(),
  state: extensionStateType
});
const extensionConfigurationValuesType = z
  .record(z.string(), z.json())
  .describe("Field values by key; unset fields use their defaults");
const extensionConfigurationStateType = z.object({
  values: extensionConfigurationValuesType.describe("Non-secret values, with defaults"),
  secrets: z
    .record(z.string(), z.object({ updatedAt: z.iso.datetime() }))
    .describe("Secret fields that have a value; values are never returned"),
  revision: z.int().positive()
});
const extensionSelfConfigurationType = z.object({
  values: extensionConfigurationValuesType.describe("All values, including secret fields"),
  revision: z.int().positive()
});
const extensionStorageEntryType = z.object({
  key: z.string(),
  value: z.json(),
  updatedAt: z.iso.datetime()
});
const extensionStorageWriteType = z.object({ key: z.string(), updatedAt: z.iso.datetime() });
const extensionStoragePageType = z.object({
  data: z.array(extensionStorageEntryType),
  hasMore: z.boolean()
});
const extensionNotificationType = z
  .strictObject({
    type: z.literal("delivery"),
    deliveryID: publicID("whdel"),
    eventID: publicID("whevt"),
    eventType: outboundEventNameType,
    extensionID: publicID("ext"),
    version: z.string().describe("The extension version when the notification was sent"),
    instance: z.string().describe("The API URL of the instance; check it against an allowlist"),
    occurredAt: z.iso.datetime()
  })
  .describe(
    "The unsigned body of an extension webhook request. Fetch the delivery to confirm it and read the event."
  );
const extensionDeliveryType = z.object({
  deliveryID: publicID("whdel"),
  event: outboundEventType.describe("The event as the extension's webhook receives it")
});
const extensionWebhookType = z.object({
  webhookID: z.string().describe("The manifest webhook ID"),
  url: z.string(),
  eventTypes: z.array(outboundEventNameType),
  enabled: z.boolean(),
  disabledReason: z
    .enum(["manual", "failures", "extension"])
    .nullable()
    .describe("`extension`: the webhook has no lifecycle events and the extension is inactive"),
  health: webhookEndpointType.shape.health
});
const extensionWebhookInputType = z.object({
  extensionID: publicID("ext"),
  webhookID: z.string().max(64)
});
const extensionWebhookDeliveryType = webhookDeliveryType.extend({ type: outboundEventNameType });
const extensionWebhookDeliveryListType = z.strictObject({
  data: z.array(extensionWebhookDeliveryType),
  pagination: paginationType
});
const extensionWebhookDeliveryDetailsType = z.strictObject({
  delivery: extensionWebhookDeliveryType,
  payload: z.discriminatedUnion("availability", [
    z.strictObject({ availability: z.literal("available"), event: outboundEventType }),
    z.strictObject({ availability: z.literal("forbidden") })
  ]),
  currentRun: webhookRunType.nullable()
});
const historyLimitType = z.number().int().min(1).max(100).default(25);
const extensionWebhookDeliveryListInputType = extensionWebhookInputType.extend({
  cursor: publicID("whdel").optional(),
  state: webhookDeliveryType.shape.state.optional(),
  limit: historyLimitType
});
const extensionWebhookDeliveryInputType = extensionWebhookInputType.extend({
  deliveryID: publicID("whdel")
});
const extensionWebhookRunListInputType = extensionWebhookDeliveryInputType.extend({
  cursor: publicID("whrun").optional(),
  limit: historyLimitType
});
const extensionWebhookAttemptListInputType = extensionWebhookDeliveryInputType.extend({
  runID: publicID("whrun"),
  cursor: publicID("whatt").optional(),
  limit: historyLimitType
});
const extensionWebhookRunListType = z.strictObject({
  data: z.array(webhookRunType),
  pagination: paginationType
});
const extensionWebhookAttemptListType = z.strictObject({
  data: z.array(webhookAttemptType),
  pagination: paginationType
});
const extensionSessionTokenType = z.object({
  token: z.string().describe("Opaque token for the extension backend; never stored by Andesine"),
  expiresAt: z.iso.datetime().describe("When the token stops verifying")
});

export {
  extensionWebhookDeliveryType,
  extensionWebhookDeliveryListType,
  extensionWebhookDeliveryDetailsType,
  extensionWebhookDeliveryListInputType,
  extensionWebhookDeliveryInputType,
  extensionWebhookRunListInputType,
  extensionWebhookAttemptListInputType,
  extensionWebhookRunListType,
  extensionWebhookAttemptListType,
  extensionGrantType,
  extensionPresentationType,
  extensionVersionDetailsType,
  extensionCatalogItemType,
  extensionCatalogDetailsType,
  extensionSummaryType,
  extensionDetailsType,
  extensionRuntimeType,
  extensionActiveViewType,
  extensionElementType,
  extensionElementViewSettingType,
  extensionStateType,
  extensionSelfType,
  extensionPublishableKeyType,
  extensionPublishableKeyFieldsType,
  extensionSessionCheckType,
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
  extensionNotificationType,
  extensionDeliveryType,
  extensionWebhookType,
  extensionWebhookInputType,
  extensionSessionTokenType
};
export type {
  ExtensionElement,
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
  ExtensionWebhook as ExtensionWebhookState,
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
  ExtensionSessionCheck,
  ExtensionPublishableKey,
  ExtensionInstallation,
  ExtensionElementViewSetting,
  ExtensionDevelopmentUpload
};
