import {
  type WebhookResourceScope,
  type WebhookScopeIndex,
  type WebhookEventResource
} from "@andesine/server/webhooks/recording";
import type {
  PublishingSnapshotCollectionState,
  PublishingSnapshotEntryState
} from "#backend/lib/publishing/snapshot-validation";
import { toCollectionID, toEntryID } from "@andesine/contracts/primitives";

interface PublicationWebhookResourcesInput {
  index: WebhookScopeIndex;
  beforeCollections: PublishingSnapshotCollectionState[];
  afterCollections: PublishingSnapshotCollectionState[];
  beforeEntries: PublishingSnapshotEntryState[];
  afterEntries: PublishingSnapshotEntryState[];
  changedCollectionIDs: Set<string>;
  changedEntryIDs: Set<string>;
}

const createSnapshotScopes = (
  index: WebhookScopeIndex,
  collections: PublishingSnapshotCollectionState[]
): ((collectionID: string | null) => WebhookResourceScope) => {
  const byID = new Map(collections.map((collection) => [collection.collectionID, collection]));
  const scopes = new Map<string | null, WebhookResourceScope>();
  const getScope = (collectionID: string | null): WebhookResourceScope => {
    const cached = scopes.get(collectionID);
    const ids = new Set<string>();

    let currentID = collectionID;

    if (cached) return cached;

    while (currentID) {
      const collection = byID.get(currentID);
      const id = toCollectionID(currentID);

      if (!collection || ids.has(id)) throw new Error("Invalid webhook snapshot ancestry");

      ids.add(id);
      currentID = collection.parentID;
    }

    ids.add(index.rootID);

    const scope: WebhookResourceScope = {
      workspaceID: index.workspaceID,
      ancestry: [...ids].map((id) => {
        const currentScope = index.getCurrentScope(id);

        if (!currentScope) throw new Error("Webhook snapshot collection is unavailable");

        // Published roots can omit working-tree ancestors. Preserve their restrictions
        // without adding those ancestors to the snapshot's filter path.
        return { id, restricted: currentScope.ancestry.some((ancestor) => ancestor.restricted) };
      })
    };

    scopes.set(collectionID, scope);

    return scope;
  };

  return getScope;
};
const scopesEqual = (before: WebhookResourceScope, after: WebhookResourceScope): boolean =>
  before.ancestry.length === after.ancestry.length &&
  before.ancestry.every((ancestor, index) => ancestor.id === after.ancestry[index]!.id);
const getPublicationWebhookResources = (
  input: PublicationWebhookResourcesInput
): WebhookEventResource[] => {
  const beforeScope = createSnapshotScopes(input.index, input.beforeCollections);
  const afterScope = createSnapshotScopes(input.index, input.afterCollections);
  const beforeCollections = new Map(input.beforeCollections.map((row) => [row.collectionID, row]));
  const afterCollections = new Map(input.afterCollections.map((row) => [row.collectionID, row]));
  const beforeEntries = new Map(input.beforeEntries.map((row) => [row.entryID, row]));
  const afterEntries = new Map(input.afterEntries.map((row) => [row.entryID, row]));
  const resources: WebhookEventResource[] = [];

  for (const id of new Set([...beforeCollections.keys(), ...afterCollections.keys()])) {
    const before = beforeCollections.has(id) ? beforeScope(id) : null;
    const after = afterCollections.has(id) ? afterScope(id) : null;

    if (before && after && !input.changedCollectionIDs.has(id) && scopesEqual(before, after)) {
      continue;
    }

    resources.push({ kind: "collection", id: toCollectionID(id), before, after });
  }

  for (const id of new Set([...beforeEntries.keys(), ...afterEntries.keys()])) {
    const previous = beforeEntries.get(id);
    const next = afterEntries.get(id);
    const before = previous ? beforeScope(previous.collectionID) : null;
    const after = next ? afterScope(next.collectionID) : null;

    if (before && after && !input.changedEntryIDs.has(id) && scopesEqual(before, after)) continue;

    resources.push({ kind: "entry", id: toEntryID(id), before, after });
  }

  return resources;
};

export { getPublicationWebhookResources };
