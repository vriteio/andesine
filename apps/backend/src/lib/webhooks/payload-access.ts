import { entries, type DatabaseClient } from "@andesine/server/database";
import {
  getRestrictedWebhookScopeIDs,
  loadWebhookScopeIndex,
  type WebhookResourceScope
} from "@andesine/server/webhooks/recording";
import { loadAuthorizedCollectionTree } from "#backend/lib/policy/authorized-collection-tree";
import { hasAuthPermission, hasAuthorizationRequirements } from "#backend/lib/policy/permissions";
import type { SessionData } from "#backend/lib/policy/session";
import { toCollectionID, toUUID } from "@andesine/contracts/primitives";
import { and, eq } from "drizzle-orm";
import { webhookCatalog } from "./catalog";
import { type WebhookEvent, webhookReadRequirements } from "@andesine/contracts/webhooks";
import { canReadWebhookResource } from "./permissions";

interface WebhookPayloadAccessInput {
  auth: SessionData;
  database: DatabaseClient;
  event: WebhookEvent;
  // The recorder must supply the trusted ancestry for the locations that remain
  // visible in this delivery's projected payload. Never accept it from a client.
  scopes: WebhookResourceScope[];
}

const canReadWebhookPayload = async (input: WebhookPayloadAccessInput): Promise<boolean> => {
  const { auth, database, event, scopes } = input;
  const required = webhookCatalog[event.type].requiredPermissions;

  const authorized =
    auth.workspaceID === event.workspaceID &&
    hasAuthorizationRequirements(auth, webhookReadRequirements) &&
    required.every((permission) => canReadWebhookResource(auth, permission));

  if (!authorized) return false;

  // Synthetic samples have no workspace content or captured resource scopes.
  if (event.test) return true;

  // Channel payloads contain channel metadata and snapshot references only.
  // Fetching snapshot content still uses the content API's own authorization.
  if (event.subject.kind === "channel") return true;
  const invalidScopes =
    scopes.length === 0 ||
    scopes.some((scope) => scope.workspaceID !== auth.workspaceID || scope.ancestry.length === 0);

  if (invalidScopes) return false;

  const [index, authorization] = await Promise.all([
    loadWebhookScopeIndex({ database, workspaceID: auth.workspaceID, includeDeleted: true }),
    loadAuthorizedCollectionTree({ auth, database, includeDeleted: true })
  ]);
  const canReadAllRestricted = hasAuthPermission(auth, "read:restricted_collections");
  const canReadCaptured = scopes.every((scope) =>
    getRestrictedWebhookScopeIDs(index, scope).every(
      (id) => canReadAllRestricted || authorization.canAccessCollection(id)
    )
  );
  const isScopeExit =
    (event.type === "entry.moved" || event.type === "collection.moved") &&
    event.data.scopeTransition === "left";

  if (!index.rootID || !canReadCaptured) return false;
  // A minimal scope exit deliberately does not grant access at the new location.
  if (isScopeExit) return true;

  if (event.subject.kind === "collection") {
    return index.collections.has(event.subject.id)
      ? authorization.canCollection(event.subject.id, "collection:read")
      : event.type === "collection.deleted";
  }

  const [entry] = await database
    .select({ collectionID: entries.collectionID })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceID, toUUID(auth.workspaceID)),
        eq(entries.id, toUUID(event.subject.id))
      )
    )
    .limit(1);

  return entry
    ? authorization.canEntry(
        entry.collectionID ? toCollectionID(entry.collectionID) : null,
        "entry:read"
      )
    : event.type === "entry.deleted";
};

export { canReadWebhookPayload };
