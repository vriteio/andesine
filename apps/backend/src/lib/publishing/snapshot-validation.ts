import { collections, entries, entryVersions, lexoRank } from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";

interface PublishingSnapshotCollectionState {
  collectionID: string;
  name: string;
  parentID: string | null;
  publishedRoot: boolean;
  rank: string;
}
interface PublishingSnapshotEntryState {
  collectionID: string | null;
  entryID: string;
  publishedAt: Date;
  publisherID: string | null;
  rank: string;
  versionID: string;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const rankType = lexoRank();
const assertUniqueOperations = (
  changedIDs: string[],
  removedIDs: string[],
  resource: string
): void => {
  const changed = new Set(changedIDs);
  const removed = new Set(removedIDs);

  if (changed.size !== changedIDs.length || removed.size !== removedIDs.length) {
    throw new ORPCError("BAD_REQUEST", { message: `Duplicate ${resource} operation` });
  }

  for (const id of changed) {
    if (removed.has(id)) {
      throw new ORPCError("BAD_REQUEST", {
        message: `A ${resource} cannot be changed and removed in one operation`
      });
    }
  }
};
const assertValidRank = (rank: string): void => {
  if (!rankType.safeParse(rank).success) {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid publication ordering value" });
  }
};
const assertManifestStructure = (
  collectionStates: PublishingSnapshotCollectionState[],
  entryStates: PublishingSnapshotEntryState[]
): void => {
  const collectionsByID = new Map(
    collectionStates.map((collection) => [collection.collectionID, collection])
  );
  const collectionRanks = new Set<string>();
  const entryRanks = new Set<string>();

  for (const collection of collectionStates) {
    const rankKey = `${collection.parentID || "root"}:${collection.rank}`;

    assertValidRank(collection.rank);

    if (collection.parentID && !collectionsByID.has(collection.parentID)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "A snapshot collection parent is not part of the snapshot"
      });
    }

    if (collection.parentID === collection.collectionID) {
      throw new ORPCError("BAD_REQUEST", { message: "A collection cannot be its own parent" });
    }

    if (collection.publishedRoot !== (collection.parentID === null)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Only top-level snapshot collections can be published roots"
      });
    }

    if (collectionRanks.has(rankKey)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Snapshot collections cannot have duplicate sibling ordering values"
      });
    }

    collectionRanks.add(rankKey);
  }

  for (const collection of collectionStates) {
    const visited = new Set<string>();
    let current: PublishingSnapshotCollectionState | undefined = collection;

    while (current) {
      if (visited.has(current.collectionID)) {
        throw new ORPCError("BAD_REQUEST", { message: "Snapshot collections contain a cycle" });
      }

      visited.add(current.collectionID);
      current = current.parentID ? collectionsByID.get(current.parentID) : undefined;
    }
  }

  for (const entry of entryStates) {
    const rankKey = `${entry.collectionID || "root"}:${entry.rank}`;

    assertValidRank(entry.rank);

    if (entry.collectionID && !collectionsByID.has(entry.collectionID)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "An entry snapshot collection is not part of the snapshot"
      });
    }

    if (entryRanks.has(rankKey)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Snapshot entries cannot have duplicate sibling ordering values"
      });
    }

    entryRanks.add(rankKey);
  }
};
const getRequiredCollectionIDs = (
  collectionStates: PublishingSnapshotCollectionState[],
  changedCollectionStates: PublishingSnapshotCollectionState[],
  changedEntryStates: PublishingSnapshotEntryState[]
): string[] => {
  const collectionsByID = new Map(
    collectionStates.map((collection) => [collection.collectionID, collection])
  );
  const requiredCollectionIDs = new Set(
    changedCollectionStates.map(({ collectionID }) => collectionID)
  );

  for (const entry of changedEntryStates) {
    if (entry.collectionID) requiredCollectionIDs.add(entry.collectionID);
  }

  for (const collectionID of [...requiredCollectionIDs]) {
    let current = collectionsByID.get(collectionID);

    while (current?.parentID) {
      requiredCollectionIDs.add(current.parentID);
      current = collectionsByID.get(current.parentID);
    }
  }

  return [...requiredCollectionIDs];
};
const assertChangedResources = async (
  database: DatabaseTransaction,
  workspaceID: string,
  collectionStates: PublishingSnapshotCollectionState[],
  changedCollectionStates: PublishingSnapshotCollectionState[],
  changedEntryStates: PublishingSnapshotEntryState[]
): Promise<void> => {
  const collectionIDs = getRequiredCollectionIDs(
    collectionStates,
    changedCollectionStates,
    changedEntryStates
  );
  const entryIDs = [...new Set(changedEntryStates.map(({ entryID }) => entryID))];
  const versionIDs = [...new Set(changedEntryStates.map(({ versionID }) => versionID))];
  const collectionRows =
    collectionIDs.length > 0
      ? await database
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.workspaceID, workspaceID),
              inArray(collections.id, collectionIDs),
              isNull(collections.deletedAt)
            )
          )
      : [];
  const entryRows =
    entryIDs.length > 0
      ? await database
          .select({ id: entries.id })
          .from(entries)
          .where(
            and(
              eq(entries.workspaceID, workspaceID),
              inArray(entries.id, entryIDs),
              isNull(entries.deletedAt)
            )
          )
      : [];
  const versionRows =
    versionIDs.length > 0
      ? await database
          .select({ id: entryVersions.id, entryID: entryVersions.entryID })
          .from(entryVersions)
          .where(
            and(eq(entryVersions.workspaceID, workspaceID), inArray(entryVersions.id, versionIDs))
          )
      : [];
  const availableCollectionIDs = new Set(collectionRows.map(({ id }) => id));
  const availableEntryIDs = new Set(entryRows.map(({ id }) => id));
  const versionEntryIDs = new Map(versionRows.map((version) => [version.id, version.entryID]));

  if (availableCollectionIDs.size !== collectionIDs.length) {
    throw new ORPCError("NOT_FOUND", { message: "Snapshot collection not found" });
  }

  if (availableEntryIDs.size !== entryIDs.length) {
    throw new ORPCError("NOT_FOUND", { message: "Snapshot entry not found" });
  }

  for (const entry of changedEntryStates) {
    if (versionEntryIDs.get(entry.versionID) !== entry.entryID) {
      throw new ORPCError("NOT_FOUND", { message: "Snapshot entry version not found" });
    }
  }
};

export { assertChangedResources, assertManifestStructure, assertUniqueOperations };
export type { PublishingSnapshotCollectionState, PublishingSnapshotEntryState };
