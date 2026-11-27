import { type MenuItem } from "@andesine/components";
import { config } from "#web/lib/api";
import { type Share } from "#web/lib/data";

interface ShareChanges {
  access?: ShareAccess;
  expiresAt?: string | null;
}
interface ShareSettings {
  access: ShareAccess;
  /** The selected expiry option, or null for a set date. */
  expiry: string | null;
  maxExpiryDays: number | null;
  setAccess(access: ShareAccess): void;
  setExpiry(value: string): void;
}

type ShareAccess = Share["access"];

const ACCESS_LABELS: Record<ShareAccess, string> = {
  comment: "Can comment",
  view: "Can view"
};
const ACCESS_OPTIONS = Object.entries(ACCESS_LABELS).map(([value, label]) => ({ value, label }));
const EXPIRY_OPTIONS = [
  { value: "never", label: "No expiry" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" }
];

const toExpiresAt = (value: string) => {
  if (value === "never") return null;

  return new Date(Date.now() + Number(value) * 24 * 60 * 60 * 1000).toISOString();
};
const getExpiryOptions = (maxExpiryDays: number | null) => {
  return EXPIRY_OPTIONS.filter(({ value }) => {
    return maxExpiryDays ? value !== "never" && Number(value) <= maxExpiryDays : true;
  });
};
const getShareURL = (share: Share) => {
  return new URL(`/share/${share.token ?? share.id}`, config.PUBLIC_APP_URL).toString();
};
/** For a share or for new invites. */
const getSettingsItems = (settings: ShareSettings): MenuItem[] => [
  {
    label: "Set access",
    icon: "i-lucide:shield",
    items: ACCESS_OPTIONS.map(({ value, label }) => ({
      label,
      selected: settings.access === value,
      onClick: () => settings.setAccess(value as ShareAccess)
    }))
  },
  {
    label: "Set expiry",
    icon: "i-lucide:clock",
    items: getExpiryOptions(settings.maxExpiryDays).map(({ value, label }) => ({
      label: value === "never" ? label : `In ${label}`,
      selected: settings.expiry === value,
      onClick: () => settings.setExpiry(value)
    }))
  }
];

export {
  ACCESS_LABELS,
  EXPIRY_OPTIONS,
  getExpiryOptions,
  getSettingsItems,
  getShareURL,
  toExpiresAt
};
export type { ShareAccess, ShareChanges };
