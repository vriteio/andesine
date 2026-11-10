import { type DatabaseClient } from "@andesine/server/database";
import { type WebhookConfiguration, type WebhookScope } from "@andesine/contracts/webhooks";
import { type Collection } from "@andesine/contracts/entities";
import { loadCollectionTree } from "../data/collection-tree";

interface WebhookScopeCollection {
  id: string;
  restricted: boolean;
}
// Trusted recorder context, not client input. IDs are public IDs, nearest first.
interface WebhookResourceScope {
  workspaceID: string;
  ancestry: WebhookScopeCollection[];
}
interface WebhookScopeIndex {
  workspaceID: string;
  collections: Map<string, Collection>;
  rootID: string;
  getCurrentScope: (collectionID: string | null) => WebhookResourceScope | null;
}
interface WebhookScopeAccess {
  allowsChannel: (code: string) => boolean;
  allowsCollection: (collectionID: string | null) => boolean;
  allowsCapturedScope: (scope: WebhookResourceScope) => boolean;
}
interface LoadWebhookScopeIndexInput {
  database: DatabaseClient;
  workspaceID: string;
  includeDeleted?: boolean;
}

const createWebhookScopeIndex = (
  workspaceID: string,
  collections: Collection[]
): WebhookScopeIndex => {
  const byID = new Map(collections.map((collection) => [collection.id, collection]));
  const childIDs = new Set(collections.flatMap((collection) => collection.descendants));
  const rootID = collections.find((collection) => !childIDs.has(collection.id))?.id || "";
  const getCurrentScope = (collectionID: string | null): WebhookResourceScope | null => {
    const collection = byID.get(collectionID ?? rootID);

    if (!collection || !rootID) return null;

    const ids = [...new Set([collection.id, ...[...collection.ancestors].reverse(), rootID])];

    // Incomplete ancestry must not be treated as unrestricted.
    if (ids.some((id) => !byID.has(id))) return null;

    return {
      workspaceID,
      ancestry: ids.map((id) => ({ id, restricted: byID.get(id)!.restricted }))
    };
  };

  return { workspaceID, collections: byID, rootID, getCurrentScope };
};
const loadWebhookScopeIndex = async (
  input: LoadWebhookScopeIndexInput
): Promise<WebhookScopeIndex> => {
  const tree = await loadCollectionTree(input.workspaceID, input.includeDeleted, input.database);

  return createWebhookScopeIndex(input.workspaceID, tree.collections);
};
const getRestrictedWebhookScopeIDs = (
  index: WebhookScopeIndex,
  scope: WebhookResourceScope
): string[] =>
  scope.ancestry
    .filter(
      (collection) => collection.restricted || index.collections.get(collection.id)?.restricted
    )
    .map((collection) => collection.id);
// Selection only: whether a location is inside the configured collection roots.
const matchesWebhookCollections = (
  scope: WebhookResourceScope,
  collections: WebhookConfiguration["collections"]
): boolean => {
  return (
    collections.mode === "all" ||
    collections.roots.some((root) => scope.ancestry.some(({ id }) => id === root))
  );
};
// The stored scope is the webhook's whole visibility boundary. Required read permissions
// follow the selected events and are checked against the manager when configuring.
const createWebhookScopeAccess = (
  scope: WebhookScope,
  index: WebhookScopeIndex
): WebhookScopeAccess => {
  const allowsChannel = (code: string): boolean =>
    Boolean(index.rootID) && (scope.channels.mode === "all" || scope.channels.codes.includes(code));
  const allowsCapturedScope = (resourceScope: WebhookResourceScope): boolean => {
    const knownRoots =
      scope.collections.mode === "all" ||
      scope.collections.roots.some((root) => index.collections.has(root));
    const hasRestrictedBoundary = getRestrictedWebhookScopeIDs(index, resourceScope).length > 0;

    return (
      resourceScope.workspaceID === index.workspaceID &&
      Boolean(index.rootID) &&
      resourceScope.ancestry.length > 0 &&
      knownRoots &&
      matchesWebhookCollections(resourceScope, scope.collections) &&
      (!hasRestrictedBoundary || scope.restrictedContent)
    );
  };
  const allowsCollection = (collectionID: string | null): boolean => {
    const resourceScope = index.getCurrentScope(collectionID);

    return resourceScope !== null && allowsCapturedScope(resourceScope);
  };

  return { allowsChannel, allowsCollection, allowsCapturedScope };
};

export {
  createWebhookScopeIndex,
  loadWebhookScopeIndex,
  getRestrictedWebhookScopeIDs,
  matchesWebhookCollections,
  createWebhookScopeAccess
};
export type { WebhookResourceScope, WebhookScopeIndex, WebhookScopeAccess };
