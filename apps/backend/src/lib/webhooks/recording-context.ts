import type { outboundEventResources } from "#backend/db/outbound-events";
import { publicID, toCollectionID, toEntryID, toUUID } from "#backend/lib/primitives/id";
import { webhookEventType, type WebhookEvent } from "./events";
import type { WebhookResourceScope, WebhookScopeIndex } from "./scope";
import type { WebhookOperation } from "./operation";

interface WebhookEventResource {
  kind: "entry" | "collection";
  id: string;
  before: WebhookResourceScope | null;
  after: WebhookResourceScope | null;
}
interface WebhookEventChange {
  event: WebhookEvent;
  resources: WebhookEventResource[];
}

type WebhookResourceRow = typeof outboundEventResources.$inferSelect;

const validateWebhookEventChange = (
  change: WebhookEventChange,
  operation: WebhookOperation,
  index: WebhookScopeIndex
): WebhookEventChange => {
  const event = webhookEventType.parse(change.event);
  const resources = structuredClone(change.resources);
  const identities = new Set<string>();

  if (
    event.workspaceID !== operation.workspaceID ||
    event.operationID !== operation.id ||
    event.test
  ) {
    throw new Error("Invalid webhook recording context");
  }

  for (const resource of resources) {
    const identity = `${resource.kind}:${resource.id}`;

    publicID(resource.kind === "entry" ? "ent" : "coll").parse(resource.id);

    if (identities.has(identity) || (!resource.before && !resource.after)) {
      throw new Error("Webhook resources must be unique and have a captured scope");
    }

    identities.add(identity);

    for (const scope of [resource.before, resource.after]) {
      if (!scope) continue;

      const ids = scope.ancestry.map(({ id }) => publicID("coll").parse(id));
      const validScope =
        scope.workspaceID === operation.workspaceID &&
        ids.length > 0 &&
        ids[ids.length - 1] === index.rootID &&
        new Set(ids).size === ids.length &&
        scope.ancestry.every(({ restricted }) => typeof restricted === "boolean") &&
        (resource.kind === "entry" || ids[0] === resource.id);

      if (!validScope) throw new Error("Invalid captured webhook resource scope");
    }
  }

  if (event.subject.kind === "channel") {
    const needsResources = event.type === "publishing.channel_advanced";

    if (needsResources !== resources.length > 0) {
      throw new Error("Only channel advancement requires changed publication resources");
    }

    if (
      event.type === "publishing.channel_advanced" &&
      event.data.previousSnapshotID === event.data.snapshotID
    ) {
      throw new Error("Channel advancement requires a changed snapshot");
    }

    return { event, resources };
  }

  const [resource] = resources;

  if (
    resources.length !== 1 ||
    !resource ||
    resource.kind !== event.subject.kind ||
    resource.id !== event.subject.id
  ) {
    throw new Error("Webhook scope must describe its subject");
  }

  const assertLocation = (scope: WebhookResourceScope | null, parentID: string | null): void => {
    const parent = scope?.ancestry[resource.kind === "entry" ? 0 : 1]?.id;

    if (!scope || (parent ?? index.rootID) !== (parentID ?? index.rootID)) {
      throw new Error("Webhook location does not match its captured scope");
    }
  };

  if (resource.after) {
    const current = index.getCurrentScope(resource.after.ancestry[0]!.id);
    const matchesCurrentScope =
      current !== null &&
      current.ancestry.length === resource.after.ancestry.length &&
      current.ancestry.every((collection, depth) => {
        return (
          collection.id === resource.after!.ancestry[depth]!.id &&
          collection.restricted === resource.after!.ancestry[depth]!.restricted
        );
      });

    if (!matchesCurrentScope) {
      throw new Error("Webhook after-scope must match the committed collection tree");
    }
  }

  if (event.type === "entry.moved" || event.type === "collection.moved") {
    if (event.data.scopeTransition !== "within") {
      throw new Error("Record both move locations before projecting a webhook payload");
    }

    assertLocation(resource.before, event.data.from.parentID);
    assertLocation(resource.after, event.data.to.parentID);
  } else {
    const deleted = event.type === "entry.deleted" || event.type === "collection.deleted";
    const parentID =
      "collectionID" in event.data
        ? event.data.collectionID
        : "parentID" in event.data
          ? event.data.parentID
          : undefined;

    if (parentID === undefined) throw new Error("Webhook resource location is missing");

    assertLocation(deleted ? resource.before : resource.after, parentID);
  }

  return { event, resources };
};
const getWebhookResourceRows = (change: WebhookEventChange): WebhookResourceRow[] => {
  const rows: WebhookResourceRow[] = [];

  for (const resource of change.resources) {
    for (const side of ["before", "after"] as const) {
      resource[side]?.ancestry.forEach((collection, depth) => {
        rows.push({
          workspaceID: toUUID(change.event.workspaceID),
          eventID: toUUID(change.event.id),
          resourceKind: resource.kind,
          resourceID: toUUID(resource.id),
          side,
          depth,
          collectionID: toUUID(collection.id),
          restricted: collection.restricted
        });
      });
    }
  }

  return rows;
};
const restoreWebhookEventResources = (
  rows: WebhookResourceRow[],
  index: WebhookScopeIndex
): WebhookEventResource[] => {
  const resources = new Map<string, WebhookEventResource>();
  const eventID = rows[0]?.eventID;

  for (const row of [...rows].sort((first, second) => first.depth - second.depth)) {
    const key = `${row.resourceKind}:${row.resourceID}`;
    const resource = resources.get(key) ?? {
      kind: row.resourceKind,
      id: row.resourceKind === "entry" ? toEntryID(row.resourceID) : toCollectionID(row.resourceID),
      before: null,
      after: null
    };
    const scope = resource[row.side] ?? { workspaceID: index.workspaceID, ancestry: [] };

    if (
      row.workspaceID !== toUUID(index.workspaceID) ||
      row.eventID !== eventID ||
      row.depth !== scope.ancestry.length ||
      (!row.collectionID && (!index.rootID || row.restricted))
    ) {
      throw new Error("Invalid stored webhook resource scope");
    }

    scope.ancestry.push({
      id: row.collectionID ? toCollectionID(row.collectionID) : index.rootID,
      restricted: row.restricted
    });
    resource[row.side] = scope;
    resources.set(key, resource);
  }

  return [...resources.values()];
};

export { validateWebhookEventChange, getWebhookResourceRows, restoreWebhookEventResources };
export type { WebhookEventResource, WebhookEventChange };
