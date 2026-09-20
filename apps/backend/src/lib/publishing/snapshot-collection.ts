import {
  collections,
  entries,
  publishingSnapshotCollections,
  publishingSnapshotEntries
} from "#backend/db";
import type { db } from "#backend/lib/adapters";
import type { AuthorizedCollectionTree } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { PublishingSnapshotCollectionChange } from "./snapshot-commit";
import { resolveSnapshotCollectionRanks } from "./snapshot-collection-order";
import { resolvePublishingSnapshot } from "./snapshot-state";

interface ResolveCollectionSnapshotInput {
  channelCode: string;
  collectionIDs: string[];
  workspaceID: string;
}
interface ResolveCollectionSnapshotChangesInput extends ResolveCollectionSnapshotInput {
  authorization: AuthorizedCollectionTree;
}
interface ResolvedCollectionSnapshotChanges {
  collectionChanges: PublishingSnapshotCollectionChange[];
  collectionRemovals: string[];
  entryRemovals: string[];
  snapshotID: string;
}
interface ResolveCollectionSnapshotRemovalsInput extends ResolveCollectionSnapshotInput {
  includeWorkingTree?: boolean;
}
interface WorkingCollectionNode {
  id: string;
  name: string;
  parentID: string | null;
  publishingEnabled: boolean;
  rank: string;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getDescendantIDs = <Node extends { parentID: string | null }>(
  nodesByID: Map<string, Node>,
  rootID: string
): Set<string> => {
  const descendantIDs = new Set([rootID]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const [id, node] of nodesByID) {
      if (node.parentID && descendantIDs.has(node.parentID) && !descendantIDs.has(id)) {
        descendantIDs.add(id);
        changed = true;
      }
    }
  }

  return descendantIDs;
};
const getPublishedPath = (
  collectionsByID: Map<string, WorkingCollectionNode>,
  collectionID: string
): WorkingCollectionNode[] => {
  const path: WorkingCollectionNode[] = [];
  let collection = collectionsByID.get(collectionID);
  let publishedRootIndex = -1;

  while (collection) {
    path.push(collection);
    collection = collection.parentID ? collectionsByID.get(collection.parentID) : undefined;
  }

  for (let index = 0; index < path.length; index += 1) {
    if (path[index].publishingEnabled) publishedRootIndex = index;
  }

  if (publishedRootIndex === -1) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Publishing is not enabled for this collection",
      data: {
        hints: [
          "Use publishing.setCollection to enable publishing on this collection or an ancestor before publishing it."
        ]
      }
    });
  }

  return path.slice(0, publishedRootIndex + 1).reverse();
};
const loadAcceptedSnapshotState = async (
  database: DatabaseTransaction,
  workspaceID: string,
  channelCode: string
) => {
  const snapshot = await resolvePublishingSnapshot(database, workspaceID, { channelCode });
  const [acceptedCollections, acceptedEntries] = await Promise.all([
    database
      .select({
        collectionID: publishingSnapshotCollections.collectionID,
        name: publishingSnapshotCollections.name,
        parentID: publishingSnapshotCollections.parentID,
        publishedRoot: publishingSnapshotCollections.publishedRoot,
        rank: publishingSnapshotCollections.rank
      })
      .from(publishingSnapshotCollections)
      .where(eq(publishingSnapshotCollections.snapshotID, snapshot.id))
      .orderBy(asc(publishingSnapshotCollections.collectionID)),
    database
      .select({
        collectionID: publishingSnapshotEntries.collectionID,
        entryID: publishingSnapshotEntries.entryID
      })
      .from(publishingSnapshotEntries)
      .where(eq(publishingSnapshotEntries.snapshotID, snapshot.id))
      .orderBy(asc(publishingSnapshotEntries.entryID))
  ]);

  return { acceptedCollections, acceptedEntries, snapshotID: snapshot.id };
};
const resolveCollectionSnapshotChanges = async (
  database: DatabaseTransaction,
  input: ResolveCollectionSnapshotChangesInput
): Promise<ResolvedCollectionSnapshotChanges> => {
  const [workingCollections, workingEntries, accepted] = await Promise.all([
    database
      .select({
        id: collections.id,
        name: collections.name,
        parentID: collections.parentID,
        publishingEnabled: collections.publishingEnabled,
        rank: collections.rank
      })
      .from(collections)
      .where(and(eq(collections.workspaceID, input.workspaceID), isNull(collections.deletedAt))),
    database
      .select({ collectionID: entries.collectionID, deletedAt: entries.deletedAt, id: entries.id })
      .from(entries)
      .where(eq(entries.workspaceID, input.workspaceID)),
    loadAcceptedSnapshotState(database, input.workspaceID, input.channelCode)
  ]);
  const workingCollectionsByID = new Map(
    workingCollections.map((collection) => [collection.id, collection])
  );
  const acceptedCollectionsByID = new Map(
    accepted.acceptedCollections.map((collection) => [collection.collectionID, collection])
  );
  const workingEntriesByID = new Map(workingEntries.map((entry) => [entry.id, entry]));
  const selectedWorkingCollectionIDs = new Set<string>();
  const selectedAcceptedCollectionIDs = new Set<string>();
  const requiredCollectionIDs = new Set<string>();
  const publishedRootIDs = new Set<string>();

  for (const collectionID of input.collectionIDs) {
    if (!workingCollectionsByID.has(collectionID)) {
      throw new ORPCError("NOT_FOUND", { message: "Collection not found" });
    }

    const path = getPublishedPath(workingCollectionsByID, collectionID);

    publishedRootIDs.add(path[0].id);

    for (const collection of path) requiredCollectionIDs.add(collection.id);
    for (const id of getDescendantIDs(workingCollectionsByID, collectionID)) {
      if (!input.authorization.canEntry(id, "publishing:publish")) continue;

      selectedWorkingCollectionIDs.add(id);
      for (const collection of getPublishedPath(workingCollectionsByID, id)) {
        requiredCollectionIDs.add(collection.id);
      }
    }

    if (acceptedCollectionsByID.has(collectionID)) {
      for (const id of getDescendantIDs(acceptedCollectionsByID, collectionID)) {
        selectedAcceptedCollectionIDs.add(id);
      }
    }
  }

  const collectionChangesByID = new Map<string, PublishingSnapshotCollectionChange>();

  for (const collectionID of requiredCollectionIDs) {
    const collection = workingCollectionsByID.get(collectionID)!;
    const acceptedCollection = acceptedCollectionsByID.get(collectionID);
    const parentID = publishedRootIDs.has(collectionID) ? null : collection.parentID;
    const publishesCollection = selectedWorkingCollectionIDs.has(collectionID);
    const moved = !acceptedCollection || acceptedCollection.parentID !== parentID;

    collectionChangesByID.set(collectionID, {
      collectionID,
      name: publishesCollection ? collection.name : (acceptedCollection?.name ?? collection.name),
      parentID,
      publishedRoot: parentID === null,
      rank:
        publishesCollection || moved
          ? collection.rank
          : (acceptedCollection?.rank ?? collection.rank)
    });
  }

  const removedCollectionIDs = new Set(
    [...selectedAcceptedCollectionIDs].filter((collectionID) => {
      return (
        !requiredCollectionIDs.has(collectionID) &&
        input.authorization.canEntry(collectionID, "publishing:unpublish")
      );
    })
  );
  const selectedWorkingEntryIDs = new Set(
    workingEntries
      .filter(({ collectionID, deletedAt }) => {
        return Boolean(
          !deletedAt && collectionID && selectedWorkingCollectionIDs.has(collectionID)
        );
      })
      .map(({ id }) => id)
  );
  const entryRemovals = accepted.acceptedEntries
    .filter(({ collectionID, entryID }) => {
      const working = workingEntriesByID.get(entryID);

      return Boolean(
        collectionID &&
        selectedAcceptedCollectionIDs.has(collectionID) &&
        !selectedWorkingEntryIDs.has(entryID) &&
        working &&
        input.authorization.canEntry(working.collectionID, "publishing:unpublish")
      );
    })
    .map(({ entryID }) => entryID);
  const removedEntryIDs = new Set(entryRemovals);
  const retainAcceptedPath = (collectionID: string | null) => {
    let collection = collectionID ? acceptedCollectionsByID.get(collectionID) : undefined;

    while (collection && !requiredCollectionIDs.has(collection.collectionID)) {
      removedCollectionIDs.delete(collection.collectionID);
      collection = collection.parentID
        ? acceptedCollectionsByID.get(collection.parentID)
        : undefined;
    }
  };

  // Retained restricted content still needs its accepted ancestors in the manifest.
  for (const collection of accepted.acceptedCollections) {
    if (!removedCollectionIDs.has(collection.collectionID)) {
      retainAcceptedPath(collection.collectionID);
    }
  }
  for (const entry of accepted.acceptedEntries) {
    if (!removedEntryIDs.has(entry.entryID) && !selectedWorkingEntryIDs.has(entry.entryID)) {
      retainAcceptedPath(entry.collectionID);
    }
  }

  const changes = [...collectionChangesByID.values()];
  const collectionRanks = resolveSnapshotCollectionRanks({
    acceptedCollections: accepted.acceptedCollections.filter(({ collectionID }) => {
      return !removedCollectionIDs.has(collectionID);
    }),
    collectionChanges: changes,
    selectedCollectionIDs: changes
      .filter(({ collectionID, parentID }) => {
        return (
          selectedWorkingCollectionIDs.has(collectionID) ||
          acceptedCollectionsByID.get(collectionID)?.parentID !== parentID
        );
      })
      .map(({ collectionID }) => collectionID),
    workingCollections
  });
  const collectionChanges = changes.map((collection) => ({
    ...collection,
    rank: collectionRanks.get(collection.collectionID) ?? collection.rank
  }));

  return {
    collectionChanges,
    collectionRemovals: [...removedCollectionIDs],
    entryRemovals,
    snapshotID: accepted.snapshotID
  };
};
const resolveCollectionSnapshotRemovals = async (
  database: DatabaseTransaction,
  input: ResolveCollectionSnapshotRemovalsInput
): Promise<ResolvedCollectionSnapshotChanges> => {
  const accepted = await loadAcceptedSnapshotState(database, input.workspaceID, input.channelCode);
  const workingCollections = input.includeWorkingTree
    ? await database
        .select({ id: collections.id, parentID: collections.parentID })
        .from(collections)
        .where(and(eq(collections.workspaceID, input.workspaceID), isNull(collections.deletedAt)))
    : [];
  const workingCollectionsByID = new Map(
    workingCollections.map((collection) => [collection.id, collection])
  );
  const workingCollectionIDs = new Set(
    input.includeWorkingTree
      ? input.collectionIDs.flatMap((id) => [...getDescendantIDs(workingCollectionsByID, id)])
      : []
  );
  const workingEntries =
    workingCollectionIDs.size > 0
      ? await database
          .select({ id: entries.id })
          .from(entries)
          .where(
            and(
              eq(entries.workspaceID, input.workspaceID),
              inArray(entries.collectionID, [...workingCollectionIDs])
            )
          )
      : [];
  const workingEntryIDs = new Set(workingEntries.map(({ id }) => id));
  const acceptedCollectionsByID = new Map(
    accepted.acceptedCollections.map((collection) => [collection.collectionID, collection])
  );
  const collectionRemovals = new Set<string>();

  for (const collectionID of new Set([...input.collectionIDs, ...workingCollectionIDs])) {
    if (!acceptedCollectionsByID.has(collectionID)) continue;

    for (const id of getDescendantIDs(acceptedCollectionsByID, collectionID)) {
      collectionRemovals.add(id);
    }
  }

  const entryRemovals = accepted.acceptedEntries
    .filter(({ collectionID, entryID }) => {
      return (
        workingEntryIDs.has(entryID) ||
        Boolean(collectionID && collectionRemovals.has(collectionID))
      );
    })
    .map(({ entryID }) => entryID);

  return {
    collectionChanges: [],
    collectionRemovals: [...collectionRemovals],
    entryRemovals,
    snapshotID: accepted.snapshotID
  };
};

export { resolveCollectionSnapshotChanges, resolveCollectionSnapshotRemovals };
export type { ResolvedCollectionSnapshotChanges };
