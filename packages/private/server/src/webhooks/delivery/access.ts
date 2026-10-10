import {
  entries,
  extensions,
  outboundEventResources,
  type DatabaseTransaction
} from "@andesine/server/database";
import { toCollectionID, toEntryID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getWebhookConfiguration } from "../endpoints";
import { loadStoredWebhookEvent } from "../stored-event";
import {
  createWebhookScopeAccess,
  loadWebhookScopeIndex,
  matchesWebhookCollections,
  type WebhookResourceScope,
  type WebhookScopeIndex
} from "../scope";
import { restoreWebhookEventResources, type WebhookEventResource } from "../recording-context";
import type { LockedDeliveryRun } from "./locking";

// `selection_changed`: a manager changed events, collections, or channels.
// `access_revoked`: content became restricted or unavailable to the stored scope.
type AccessStopReason = "selection_changed" | "access_revoked";

const getDeliveryAccessStopReason = async (
  database: DatabaseTransaction,
  context: LockedDeliveryRun,
  // Batch callers pass one index loaded under the same workspace lock.
  scopeIndex?: WebhookScopeIndex
): Promise<AccessStopReason | null> => {
  const { endpoint, delivery } = context;
  const event = await loadStoredWebhookEvent(database, delivery);
  const workspaceID = toWorkspaceID(delivery.workspaceID);
  const configuration = getWebhookConfiguration(endpoint);

  if (event.test !== (context.run.trigger === "test")) {
    throw new Error("Webhook sample requires a test run");
  }

  if (!endpoint.eventTypes.includes(event.type) || endpoint.schemaVersion !== event.schemaVersion) {
    return "selection_changed";
  }

  if (event.subject.kind === "extension") return null;

  if (endpoint.kind === "extension") {
    // Extension webhooks receive other events only while their extension is active.
    const [active] = await database
      .select({ id: extensions.id })
      .from(extensions)
      .where(
        and(
          eq(extensions.id, endpoint.extensionID!),
          eq(extensions.enabled, true),
          isNull(extensions.disabledReason),
          isNull(extensions.uninstalledAt)
        )
      );

    if (!active) return "access_revoked";
  }

  // Synthetic samples contain no actual resources. Their example IDs must not
  // be looked up as workspace content or matched against collection scopes.
  if (event.test) return null;

  const index =
    scopeIndex ?? (await loadWebhookScopeIndex({ database, workspaceID, includeDeleted: true }));
  const access = createWebhookScopeAccess(configuration, index);
  // A resource's current location only needs to avoid restricted content; leaving
  // the selected collections after the event does not withdraw the recorded event.
  const currentAccess = createWebhookScopeAccess(
    { ...configuration, collections: { mode: "all" } },
    index
  );
  const rows = await database
    .select()
    .from(outboundEventResources)
    .where(
      and(
        eq(outboundEventResources.workspaceID, delivery.workspaceID),
        eq(outboundEventResources.eventID, delivery.eventID)
      )
    );
  const resources = restoreWebhookEventResources(rows, index);
  const allowsScope = (scope: WebhookResourceScope | null): boolean =>
    scope !== null && access.allowsCapturedScope(scope);
  const matchesScope = (scope: WebhookResourceScope | null): boolean =>
    scope !== null && matchesWebhookCollections(scope, configuration.collections);
  const currentEntryScopes = new Map<string, WebhookResourceScope | null>();
  const entryIDs = resources.filter(({ kind }) => kind === "entry").map(({ id }) => toUUID(id));

  for (let offset = 0; offset < entryIDs.length; offset += 250) {
    const currentEntries = await database
      .select({ id: entries.id, collectionID: entries.collectionID })
      .from(entries)
      .where(
        and(
          eq(entries.workspaceID, delivery.workspaceID),
          inArray(entries.id, entryIDs.slice(offset, offset + 250))
        )
      );

    for (const entry of currentEntries) {
      currentEntryScopes.set(
        toEntryID(entry.id),
        index.getCurrentScope(entry.collectionID ? toCollectionID(entry.collectionID) : null)
      );
    }
  }

  const allowsCurrent = (resource: WebhookEventResource, allowMissing: boolean): boolean => {
    const current =
      resource.kind === "entry"
        ? currentEntryScopes.get(resource.id)
        : index.collections.has(resource.id)
          ? index.getCurrentScope(resource.id)
          : undefined;

    return current === undefined
      ? allowMissing
      : current !== null && currentAccess.allowsCapturedScope(current);
  };

  if (event.subject.kind === "channel") {
    if (!access.allowsChannel(event.subject.code)) return "selection_changed";
    if (event.type !== "publishing.channel_advanced") return null;
    const selected = resources.some(
      (resource) => matchesScope(resource.before) || matchesScope(resource.after)
    );

    if (!selected) return "selection_changed";

    return resources.some(
      (resource) =>
        ((matchesScope(resource.before) && allowsScope(resource.before)) ||
          (matchesScope(resource.after) && allowsScope(resource.after))) &&
        allowsCurrent(resource, true)
    )
      ? null
      : "access_revoked";
  }

  const resource = resources.find(
    ({ kind, id }) => kind === event.subject.kind && id === event.subject.id
  );

  if (!resource) throw new Error("Webhook delivery resource context is missing");

  if (event.type === "entry.moved" || event.type === "collection.moved") {
    const visibleScopes = [
      ...(event.data.from.visibility === "visible" ? [resource.before] : []),
      ...(event.data.to.visibility === "visible" ? [resource.after] : [])
    ];

    if (!visibleScopes.some(matchesScope)) return "selection_changed";
    if (!visibleScopes.length || !visibleScopes.every(allowsScope)) return "access_revoked";

    // A retained minimal exit never exposes the new location. A broader scope must
    // not rewrite that payload; a narrower scope must still include every visible side.
    return event.data.scopeTransition === "left" || allowsCurrent(resource, false)
      ? null
      : "access_revoked";
  }

  const deleted = event.type === "entry.deleted" || event.type === "collection.deleted";
  const scope = deleted ? resource.before : resource.after;

  if (!matchesScope(scope)) return "selection_changed";

  return allowsScope(scope) && allowsCurrent(resource, deleted) ? null : "access_revoked";
};

export { getDeliveryAccessStopReason };
