import { ORPCError } from "@orpc/server";
import type { AuthorizedCollectionTree } from "#backend/lib/policy";
import type {
  PublishingChangeSet,
  PublishingChangeSetCollection,
  PublishingChangeSetEntry
} from "./change-set";

interface PublishingRevertSelection {
  all?: boolean;
  collectionIDs?: string[];
  entryIDs?: string[];
}
interface PublishingRevertScope {
  collections: PublishingChangeSetCollection[];
  entries: PublishingChangeSetEntry[];
}

const collectionHasParent = (
  collection: PublishingChangeSetCollection,
  parentIDs: Set<string>
): boolean => {
  return Boolean(
    (collection.working?.parentID && parentIDs.has(collection.working.parentID)) ||
    (collection.accepted?.parentID && parentIDs.has(collection.accepted.parentID))
  );
};
const entryHasParent = (entry: PublishingChangeSetEntry, parentIDs: Set<string>): boolean => {
  return Boolean(
    (entry.working.collectionID && parentIDs.has(entry.working.collectionID)) ||
    (entry.accepted?.collectionID && parentIDs.has(entry.accepted.collectionID))
  );
};
const resolvePublishingRevertScope = (
  changeSet: PublishingChangeSet,
  selection: PublishingRevertSelection,
  authorization: AuthorizedCollectionTree
): PublishingRevertScope => {
  const requestedCollectionIDs = new Set(selection.collectionIDs || []);
  const requestedEntryIDs = new Set(selection.entryIDs || []);
  const hasSelectedIDs = requestedCollectionIDs.size > 0 || requestedEntryIDs.size > 0;
  const collectionsByID = new Map(
    changeSet.collections
      .filter(({ id }) => authorization.canEntry(id, "publishing:read"))
      .map((collection) => [collection.id, collection])
  );
  const entriesByID = new Map(
    changeSet.entries
      .filter(({ working }) => authorization.canEntry(working.collectionID, "publishing:read"))
      .map((entry) => [entry.id, entry])
  );

  if (selection.all === true && hasSelectedIDs) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select all changes or specific items, not both"
    });
  }

  if (selection.all !== true && !hasSelectedIDs) {
    throw new ORPCError("BAD_REQUEST", { message: "No publishing changes selected" });
  }

  for (const collectionID of requestedCollectionIDs) {
    if (!collectionsByID.has(collectionID)) {
      throw new ORPCError("NOT_FOUND", { message: "Selected collection not found" });
    }
  }

  for (const entryID of requestedEntryIDs) {
    if (!entriesByID.has(entryID)) {
      throw new ORPCError("NOT_FOUND", { message: "Selected entry not found" });
    }
  }

  const selectedCollectionIDs =
    selection.all === true
      ? new Set(changeSet.collections.map((collection) => collection.id))
      : new Set(requestedCollectionIDs);
  const selectedEntryIDs =
    selection.all === true
      ? new Set(changeSet.entries.map((entry) => entry.id))
      : new Set(requestedEntryIDs);

  if (selection.all !== true) {
    let changed = true;

    while (changed) {
      changed = false;

      for (const collection of changeSet.collections) {
        if (
          selectedCollectionIDs.has(collection.id) ||
          !collectionHasParent(collection, selectedCollectionIDs)
        ) {
          continue;
        }

        selectedCollectionIDs.add(collection.id);
        changed = true;
      }
    }

    for (const entry of changeSet.entries) {
      if (entryHasParent(entry, selectedCollectionIDs)) {
        selectedEntryIDs.add(entry.id);
      }
    }
  }

  return {
    collections: [...selectedCollectionIDs].flatMap((collectionID) => {
      const collection = collectionsByID.get(collectionID);

      return collection ? [collection] : [];
    }),
    entries: [...selectedEntryIDs].flatMap((entryID) => {
      const entry = entriesByID.get(entryID);

      return entry ? [entry] : [];
    })
  };
};

export { resolvePublishingRevertScope };
export type { PublishingRevertSelection };
