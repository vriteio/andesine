import { type ExtensionGrant, type ExtensionPermission } from "@andesine/contracts/extensions";

interface GrantChanges {
  permissions: ExtensionPermission[];
  /** The new backend URL when it differs from the approved one. */
  backendURL: string | null;
  requests: string[];
}

const RESOURCE_LABELS: Record<string, string> = {
  "entries": "entries",
  "versions": "versions",
  "publishing": "publishing",
  "collections": "collections",
  "memberships": "people",
  "roles": "roles",
  "webhooks": "webhooks",
  "ai-answers": "AI answers",
  "restricted_collections": "restricted collections"
};

/** A permission in the words of the API key settings, e.g. “Read entries”, “Manage roles”. */
const describeExtensionPermission = (permission: ExtensionPermission): string => {
  const [action, resource] = permission.startsWith("read:")
    ? ["Read", permission.slice(5)]
    : ["Manage", permission];

  if (permission === "ai-answers") return "Generate AI answers";

  return `${action} ${RESOURCE_LABELS[resource] ?? resource}`;
};
const getURLHost = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
/** What a pending grant adds to the approved one; the same rules decide `approval_required`. */
const getGrantChanges = (approved: ExtensionGrant, pending: ExtensionGrant): GrantChanges => {
  const isBackendChanged =
    pending.backendURL !== null && pending.backendURL !== approved.backendURL;

  return {
    permissions: pending.permissions.filter((item) => !approved.permissions.includes(item)),
    backendURL: isBackendChanged ? pending.backendURL : null,
    requests: pending.requests.filter((url) => !approved.requests.includes(url))
  };
};

export { describeExtensionPermission, getURLHost, getGrantChanges };
export type { GrantChanges };
