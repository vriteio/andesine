import { type ExtensionDetails, type ExtensionSummary } from "@andesine/contracts/extensions";

type DisabledReason = NonNullable<ExtensionSummary["disabledReason"]>;

const DISABLED_REASON_LABELS: Record<DisabledReason, string> = {
  manual: "Disabled",
  approval_required: "Needs approval",
  configuration_required: "Needs settings",
  revoked: "Withdrawn"
};

/** Reasons that an update or a revocation set, which managers must resolve. */
const isSystemDisabled = (extension: Pick<ExtensionSummary, "disabledReason">): boolean => {
  const reason = extension.disabledReason;

  return reason !== null && reason !== "manual";
};
const getStateLabel = (extension: Pick<ExtensionSummary, "disabledReason">): string => {
  return extension.disabledReason ? DISABLED_REASON_LABELS[extension.disabledReason] : "Enabled";
};
const getStateIcon = (extension: Pick<ExtensionSummary, "disabledReason">): string => {
  if (!extension.disabledReason) return "i-lucide:circle-check text-green-500";
  if (extension.disabledReason === "revoked") return "i-lucide:shield-x text-red-500";
  if (isSystemDisabled(extension)) return "i-lucide:circle-alert text-red-500";

  // Matches the gradient used for paused webhooks.
  return "i-lucide:circle-pause bg-gradient-to-tr from-primary to-secondary";
};
const formatExtensionCount = (count: number): string => {
  return count === 1 ? "1 extension" : `${count} extensions`;
};
/** The settings path of an installed extension or a catalog item (its registry name). */
const getExtensionPath = (workspaceID: string, extensionID: string): string => {
  return `/${workspaceID}/settings/extension/${encodeURIComponent(extensionID)}`;
};
const getExtensionSettingsPath = (workspaceID: string, extensionID: string): string => {
  return `${getExtensionPath(workspaceID, extensionID)}/settings`;
};
const hasConfiguration = (extension: Pick<ExtensionDetails, "details">): boolean => {
  return Object.keys(extension.details.configuration?.properties ?? {}).length > 0;
};
const getInstallPath = (workspaceID: string, name: string): string => {
  return `/${workspaceID}/settings/extension-install/${name}`;
};

export {
  isSystemDisabled,
  getStateLabel,
  getStateIcon,
  formatExtensionCount,
  getExtensionPath,
  getExtensionSettingsPath,
  hasConfiguration,
  getInstallPath
};
