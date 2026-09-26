import {
  assertAuthorizationRequirements,
  hasAuthorizationRequirements
} from "#backend/lib/policy/permissions";
import type { SessionData } from "#backend/lib/policy/session";
import type * as z from "zod";
import { webhookCatalog } from "./catalog";
import type { WebhookEventName, webhookReadPermissionType } from "./events";
import { webhookReadRequirements, webhookManageRequirements } from "./permission-requirements";

type WebhookReadPermission = z.infer<typeof webhookReadPermissionType>;

const assertWebhookReadAccess = (auth: SessionData): void => {
  assertAuthorizationRequirements(auth, webhookReadRequirements);
};
const assertWebhookManageAccess = (auth: SessionData): void => {
  assertAuthorizationRequirements(auth, webhookManageRequirements);
};
// Session/OAuth users have baseline public-content read access. Keys need explicit
// resource permissions. Collection restrictions are checked separately, never here.
const canReadWebhookResource = (auth: SessionData, permission: WebhookReadPermission): boolean =>
  hasAuthorizationRequirements(auth, { session: true, oauth: true, key: [permission] });

// A webhook can read exactly the resource types its selected events describe.
const getWebhookRequiredPermissions = (eventTypes: WebhookEventName[]): WebhookReadPermission[] => [
  ...new Set(eventTypes.flatMap((type) => webhookCatalog[type].requiredPermissions))
];

export {
  getWebhookRequiredPermissions,
  webhookReadRequirements,
  webhookManageRequirements,
  assertWebhookReadAccess,
  assertWebhookManageAccess,
  canReadWebhookResource
};
export type { WebhookReadPermission };
