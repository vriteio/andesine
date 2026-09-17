import type { db } from "#backend/lib/adapters";
import {
  loadAuthorizedCollectionTree,
  type AuthorizedCollectionTree,
  type SessionData
} from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { loadPublishingChangeSet } from "./change-set";
import { resolvePublishingRevertDependencies } from "./revert-dependencies";
import { resolvePublishingRevertScope, type PublishingRevertSelection } from "./revert-selection";
import type {
  PublishingAcceptedCollection,
  PublishingChangeSet,
  PublishingChangeSetCollection,
  PublishingChangeSetEntry,
  PublishingWorkingCollection
} from "./change-set";

interface LoadPublishingRevertPlanInput extends PublishingRevertSelection {
  channel: string;
  collectionID: string;
  snapshotID: string;
}
interface PublishingRevertCollectionOperation {
  accepted: PublishingChangeSetCollection["accepted"];
  action: "delete" | "restore";
  collectionID: string;
  name: string;
  parentID: string | null;
  publishingEnabled: boolean;
  rank: string;
  restoreMetadata: boolean;
  restorePublishingEnabled: boolean;
  restoreStructure: boolean;
  restoreVisibility: boolean;
}
interface PublishingRevertEntryOperation {
  accepted: PublishingChangeSetEntry["accepted"];
  action: "delete" | "restore";
  entryID: string;
  restoreContent: boolean;
  restoreName: boolean;
  restoreStructure: boolean;
  restoreVisibility: boolean;
  workingCollectionID: string | null;
  workingSchemaRevisionID: string | null;
}
interface PublishingRevertDependencyCollectionOperation {
  collectionID: string;
  name: string;
  parentID: string | null;
  publishingEnabled: boolean;
  rank: string;
  restorePublishingEnabled: boolean;
  restoreStructure: boolean;
  restoreVisibility: boolean;
}
interface PublishingRevertContentEntry {
  collectionID: string | null;
  entryID: string;
}
interface PublishingRevertPlan {
  collectionID: string;
  collectionOperations: PublishingRevertCollectionOperation[];
  contentEntries: PublishingRevertContentEntry[];
  dependencyCollectionOperations: PublishingRevertDependencyCollectionOperation[];
  dependencyCollectionIDs: string[];
  entryOperations: PublishingRevertEntryOperation[];
  selectedCollectionIDs: string[];
  selectedEntryIDs: string[];
  snapshotID: string;
  workspaceRootID: string | null;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const isPending = (item: PublishingChangeSetCollection | PublishingChangeSetEntry): boolean => {
  return item.status !== "published";
};
const getCollectionDepth = (
  collectionID: string,
  collectionsByID: Map<string, PublishingAcceptedCollection>
): number => {
  const visited = new Set<string>();
  let collection = collectionsByID.get(collectionID);
  let depth = 0;

  while (collection?.parentID && !visited.has(collection.parentID)) {
    visited.add(collection.parentID);
    collection = collectionsByID.get(collection.parentID);
    depth += 1;
  }

  return depth;
};
const isWorkingDescendant = (
  collectionID: string,
  ancestorIDs: Set<string>,
  workingCollectionsByID: Map<string, PublishingWorkingCollection>
): boolean => {
  const visited = new Set<string>();
  let collection = workingCollectionsByID.get(collectionID);

  while (collection?.parentID && !visited.has(collection.parentID)) {
    if (ancestorIDs.has(collection.parentID)) return true;

    visited.add(collection.parentID);
    collection = workingCollectionsByID.get(collection.parentID);
  }

  return false;
};
const createPublishingRevertPlan = (
  changeSet: PublishingChangeSet,
  selection: PublishingRevertSelection,
  authorization: AuthorizedCollectionTree
): PublishingRevertPlan => {
  const scope = resolvePublishingRevertScope(changeSet, selection, authorization);
  const acceptedCollectionsByID = new Map(
    changeSet.acceptedCollections.map((collection) => [collection.id, collection])
  );
  const entriesByID = new Map(changeSet.entries.map((entry) => [entry.id, entry]));
  const workingCollectionsByID = new Map(
    changeSet.workingCollections.map((collection) => [collection.id, collection])
  );
  const workspaceRoot = changeSet.workingCollections.find(({ deletedAt, parentID }) => {
    return !deletedAt && parentID === null;
  });

  const selectedCollections = scope.collections.filter(isPending);
  const selectedEntries = scope.entries.filter(isPending);
  const deletedNewCollectionIDs = new Set(
    selectedCollections.filter(({ accepted }) => !accepted).map(({ id }) => id)
  );
  const topLevelDeletedNewCollectionIDs = new Set(
    [...deletedNewCollectionIDs].filter((collectionID) => {
      return !isWorkingDescendant(collectionID, deletedNewCollectionIDs, workingCollectionsByID);
    })
  );
  const getAcceptedParentID = (collection: PublishingAcceptedCollection): string | null => {
    if (collection.parentID) return collection.parentID;

    const workingParentID = workingCollectionsByID.get(collection.id)?.parentID;
    let parent = workingParentID ? workingCollectionsByID.get(workingParentID) : undefined;

    while (parent) {
      if (deletedNewCollectionIDs.has(parent.id) || parent.publishingEnabled) {
        return workspaceRoot?.id || null;
      }

      parent = parent.parentID ? workingCollectionsByID.get(parent.parentID) : undefined;
    }

    return workingParentID || workspaceRoot?.id || null;
  };
  const collectionOperations = selectedCollections
    .filter((collection) => {
      if (collection.accepted) return true;

      return topLevelDeletedNewCollectionIDs.has(collection.id);
    })
    .map((collection): PublishingRevertCollectionOperation => {
      const action = collection.accepted ? "restore" : "delete";
      const parentID = collection.accepted
        ? getAcceptedParentID(collection.accepted)
        : collection.working?.parentID || null;
      const publishingEnabled =
        collection.id === changeSet.collectionID || collection.accepted?.publishedRoot
          ? Boolean(collection.accepted?.publishedRoot)
          : Boolean(collection.working?.publishingEnabled);
      const restoreMetadata = Boolean(
        collection.accepted &&
        (collection.working?.name !== collection.accepted.name ||
          (collection.id === changeSet.collectionID &&
            collection.working?.publishingEnabled !== collection.accepted.publishedRoot))
      );

      return {
        accepted: collection.accepted,
        action,
        collectionID: collection.id,
        name: collection.accepted?.name || collection.working!.name,
        parentID,
        publishingEnabled,
        rank:
          collection.id === changeSet.collectionID
            ? collection.working?.rank || collection.accepted!.rank
            : collection.accepted?.rank || collection.working!.rank,
        restoreMetadata: action === "restore" && restoreMetadata,
        restorePublishingEnabled:
          action === "restore" && collection.working?.publishingEnabled !== publishingEnabled,
        restoreStructure:
          action === "restore" &&
          (collection.status === "pending-removal" ||
            collection.structureChanged ||
            collection.working?.parentID !== parentID),
        restoreVisibility: action === "restore" && Boolean(collection.working?.deletedAt)
      };
    });
  const entryOperations = selectedEntries
    .filter((entry) => {
      if (entry.accepted || !entry.working.collectionID) return true;

      return !(
        topLevelDeletedNewCollectionIDs.has(entry.working.collectionID) ||
        isWorkingDescendant(
          entry.working.collectionID,
          topLevelDeletedNewCollectionIDs,
          workingCollectionsByID
        )
      );
    })
    .map((entry): PublishingRevertEntryOperation => {
      const action = entry.accepted ? "restore" : "delete";

      return {
        accepted: entry.accepted,
        action,
        entryID: entry.id,
        restoreContent: action === "restore" && entry.contentChanged,
        restoreName: action === "restore" && entry.nameChanged,
        restoreStructure:
          action === "restore" && (entry.status === "pending-removal" || entry.structureChanged),
        restoreVisibility: action === "restore" && Boolean(entry.working.deletedAt),
        workingCollectionID: entry.working.collectionID,
        workingSchemaRevisionID: entry.working.schemaRevisionID
      };
    });
  const restoredCollectionIDs = new Set(
    collectionOperations
      .filter(({ action }) => action === "restore")
      .map(({ collectionID }) => collectionID)
  );
  const dependencyCollectionIDs = new Set<string>();
  const dependencyCollectionOperations = new Map<
    string,
    PublishingRevertDependencyCollectionOperation
  >();
  const acceptedRootIDs = new Map(
    changeSet.acceptedCollections.map((collection) => {
      let root = collection;

      while (root.parentID) {
        root = acceptedCollectionsByID.get(root.parentID)!;
      }

      return [collection.id, root.id];
    })
  );
  const canRestorePublishingPath = (
    parentID: string | null,
    rootID: string,
    path: Set<string>
  ): boolean => {
    const visited = new Set(path);
    const pendingIDs = parentID ? [parentID] : [];

    while (pendingIDs.length > 0) {
      const currentID = pendingIDs.pop()!;

      if (visited.has(currentID) || deletedNewCollectionIDs.has(currentID)) continue;
      if (currentID === rootID) return true;

      const workingParentID = workingCollectionsByID.get(currentID)?.parentID;
      const acceptedParentID = acceptedCollectionsByID.get(currentID)?.parentID;

      visited.add(currentID);
      // Verify the whole path: restoring an ancestor must not return to this dependency chain.
      if (acceptedParentID && acceptedRootIDs.get(currentID) === rootID) {
        pendingIDs.push(acceptedParentID);
      }

      if (workingParentID) pendingIDs.push(workingParentID);
    }

    return false;
  };
  const addDependency = (collectionID: string | null, path = new Set<string>()) => {
    if (!collectionID || path.has(collectionID)) return;

    const working = workingCollectionsByID.get(collectionID);
    const accepted = acceptedCollectionsByID.get(collectionID);

    if (!working && !accepted) return;

    const nextPath = new Set(path).add(collectionID);
    const restorePublishingEnabled = Boolean(
      accepted?.publishedRoot && !working?.publishingEnabled
    );
    const restorePublishedPath = Boolean(
      accepted?.parentID &&
      !canRestorePublishingPath(
        working?.parentID || null,
        acceptedRootIDs.get(collectionID)!,
        nextPath
      )
    );

    if (working && !working.deletedAt && !restorePublishingEnabled && !restorePublishedPath) {
      addDependency(working.parentID, nextPath);
      return;
    }

    const workingParent = working?.parentID
      ? workingCollectionsByID.get(working.parentID)
      : undefined;
    const workingParentCanBeUsed = Boolean(workingParent) && !restorePublishedPath;
    const parentID = workingParentCanBeUsed ? working!.parentID : accepted?.parentID || null;

    if (!restoredCollectionIDs.has(collectionID)) {
      dependencyCollectionIDs.add(collectionID);
      dependencyCollectionOperations.set(collectionID, {
        collectionID,
        name: working?.name || accepted!.name,
        parentID,
        publishingEnabled: working?.publishingEnabled || Boolean(accepted?.publishedRoot),
        rank: workingParentCanBeUsed ? working!.rank : accepted?.rank || working!.rank,
        restorePublishingEnabled,
        restoreStructure: working?.parentID !== parentID,
        restoreVisibility: Boolean(working?.deletedAt)
      });
    }

    addDependency(parentID, nextPath);
  };

  for (const operation of collectionOperations) {
    if (operation.action !== "restore") continue;

    addDependency(operation.parentID);
  }

  for (const operation of entryOperations) {
    if (operation.action !== "restore") continue;

    addDependency(entriesByID.get(operation.entryID)?.accepted?.collectionID || null);
  }

  resolvePublishingRevertDependencies({
    acceptedPlacementsByID: new Map(
      changeSet.acceptedCollections.map((collection) => [
        collection.id,
        { ...collection, collectionID: collection.id, parentID: getAcceptedParentID(collection) }
      ])
    ),
    activeParentIDsByID: new Map(
      changeSet.workingCollections.flatMap(({ deletedAt, id, parentID }) => {
        return deletedAt ? [] : [[id, parentID]];
      })
    ),
    addDependency,
    dependencyOperations: dependencyCollectionOperations,
    maxAttempts: changeSet.workingCollections.length,
    removedCollectionIDs: deletedNewCollectionIDs,
    requiredCollectionIDs: entryOperations.flatMap(({ accepted, action }) => {
      return action === "restore" && accepted?.collectionID ? [accepted.collectionID] : [];
    }),
    restoredOperations: collectionOperations.filter(({ action }) => action === "restore")
  });

  const collectionDepth = (collectionID: string) => {
    return getCollectionDepth(collectionID, acceptedCollectionsByID);
  };
  const dependencyOperations = [...dependencyCollectionOperations.values()];
  const dependencyOperationsByID = new Map(
    dependencyOperations.map((operation) => [operation.collectionID, operation])
  );
  const dependencyDepth = (collectionID: string, path = new Set<string>()): number => {
    if (path.has(collectionID)) return 0;

    const operation = dependencyOperationsByID.get(collectionID);

    if (!operation?.parentID || !dependencyOperationsByID.has(operation.parentID)) return 0;

    return 1 + dependencyDepth(operation.parentID, new Set(path).add(collectionID));
  };

  return {
    collectionID: changeSet.collectionID,
    collectionOperations: collectionOperations.sort((left, right) => {
      const depthDifference =
        collectionDepth(left.collectionID) - collectionDepth(right.collectionID);

      if (left.action === "delete" && right.action === "delete") return -depthDifference;
      if (left.action === "restore" && right.action === "restore") return depthDifference;

      return left.action === "restore" ? -1 : 1;
    }),
    contentEntries: scope.entries
      .filter(({ accepted }) => accepted)
      .map(({ id, working }) => ({ collectionID: working.collectionID, entryID: id })),
    dependencyCollectionOperations: dependencyOperations.sort((left, right) => {
      return dependencyDepth(left.collectionID) - dependencyDepth(right.collectionID);
    }),
    dependencyCollectionIDs: [...dependencyCollectionIDs].sort((left, right) => {
      return collectionDepth(left) - collectionDepth(right);
    }),
    entryOperations,
    selectedCollectionIDs: selectedCollections.map(({ id }) => id),
    selectedEntryIDs: selectedEntries.map(({ id }) => id),
    snapshotID: changeSet.snapshotID,
    workspaceRootID: workspaceRoot?.id || null
  };
};

const loadPublishingRevertPlan = async (
  database: DatabaseTransaction,
  auth: SessionData,
  input: LoadPublishingRevertPlanInput,
  workingContentHashes?: ReadonlyMap<string, string>
): Promise<PublishingRevertPlan> => {
  const [changeSet, authorization] = await Promise.all([
    loadPublishingChangeSet(
      database,
      toUUID(auth.workspaceID),
      {
        channel: input.channel,
        collectionID: input.collectionID,
        expectedSnapshotID: input.snapshotID
      },
      workingContentHashes
    ),
    loadAuthorizedCollectionTree({ auth, database, includeDeleted: true })
  ]);

  return createPublishingRevertPlan(
    changeSet,
    {
      all: input.all,
      collectionIDs: input.collectionIDs?.map(toUUID),
      entryIDs: input.entryIDs?.map(toUUID)
    },
    authorization
  );
};

export { createPublishingRevertPlan, loadPublishingRevertPlan };
export type {
  LoadPublishingRevertPlanInput,
  PublishingRevertCollectionOperation,
  PublishingRevertDependencyCollectionOperation,
  PublishingRevertEntryOperation,
  PublishingRevertPlan,
  PublishingRevertSelection
};
