import {
  type ExtensionGrant,
  type ExtensionSummary,
  type ExtensionVersionDetails,
  type ExtensionVersionManifest
} from "@andesine/contracts/extensions";
import { toExtensionID } from "@andesine/contracts/primitives";
import { getManifestGrant, type ExtensionRow } from "@andesine/server/extensions";
import { getExtensionState } from "./state";

type ExtensionPresentation = Omit<
  ExtensionSummary,
  "id" | "state" | "disabledReason" | "revision" | "development"
>;

const toPresentation = (version: ExtensionVersionManifest): ExtensionPresentation => {
  const { manifest, artifacts } = version;

  return {
    name: manifest.name,
    version: manifest.version,
    displayName: manifest.displayName,
    description: manifest.description,
    icon: manifest.icon ?? null,
    iconStyles: artifacts.icons ?? null
  };
};
const toVersionDetails = (version: ExtensionVersionManifest): ExtensionVersionDetails => {
  const { manifest } = version;

  return {
    ...toPresentation(version),
    publishedAt: version.publishedAt,
    sourceCommit: version.sourceCommit,
    grant: getManifestGrant(manifest),
    webhooks: Object.entries(manifest.webhooks).map(([webhookID, webhook]) => ({
      webhookID,
      events: webhook.events,
      path: webhook.path
    })),
    elementViews: manifest.elementViews,
    blockActions: manifest.blockActions,
    panels: manifest.panels,
    configuration: manifest.configuration ?? null
  };
};
const toGrant = (extension: ExtensionRow): ExtensionGrant => ({
  permissions: extension.permissions,
  backendURL: extension.backendURL,
  requests: extension.requests
});
const toExtensionSummary = (
  extension: ExtensionRow,
  version: ExtensionVersionManifest
): ExtensionSummary => {
  const state = getExtensionState(extension);

  return {
    ...toPresentation(version),
    id: toExtensionID(extension.id),
    state: state === "active" ? "active" : "disabled",
    disabledReason: state === "disabled" ? (extension.disabledReason ?? "manual") : null,
    revision: extension.revision,
    development: extension.development
  };
};

export { toPresentation, toVersionDetails, toGrant, toExtensionSummary };
