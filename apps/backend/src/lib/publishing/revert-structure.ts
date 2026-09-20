import { assertContentTreeNames } from "#backend/lib/content/names";
import { collections, entries, memberships } from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { createEffectiveSchemaChange } from "#backend/lib/schema/migration/effective-change";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { resolvePublishingRevertRanks } from "./revert-order";
import type {
  PublishingRevertCollectionOperation,
  PublishingRevertDependencyCollectionOperation,
  PublishingRevertEntryOperation,
  PublishingRevertPlan
} from "./revert-plan";

interface RevertedCollection {
  id: string;
  name: string;
  parentID: string | null;
  publishingEnabled: boolean;
  rank: string;
}
interface RevertedEntry {
  collectionID: string | null;
  id: string;
  name: string;
  rank: string;
}
interface ApplyPublishingRevertStructureResult {
  deletedCollectionIDs: string[];
  deletedEntryIDs: string[];
  restoredCollections: RevertedCollection[];
  restoredEntries: RevertedEntry[];
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const restoreCollection = async (
  database: DatabaseTransaction,
  workspaceID: string,
  operation: PublishingRevertCollectionOperation | PublishingRevertDependencyCollectionOperation,
  rank: string
): Promise<RevertedCollection> => {
  const [collection] = await database
    .update(collections)
    .set({
      deletedAt: null,
      name: operation.name,
      parentID: operation.parentID,
      publishingEnabled: operation.publishingEnabled,
      rank,
      updatedAt: new Date()
    })
    .where(
      and(eq(collections.id, operation.collectionID), eq(collections.workspaceID, workspaceID))
    )
    .returning({
      id: collections.id,
      name: collections.name,
      parentID: collections.parentID,
      publishingEnabled: collections.publishingEnabled,
      rank: collections.rank
    });

  if (!collection) throw new Error("Revert collection not found");

  return collection;
};
const restoreEntry = async (
  database: DatabaseTransaction,
  workspaceID: string,
  operation: PublishingRevertEntryOperation,
  rank: string
): Promise<RevertedEntry> => {
  const accepted = operation.accepted;

  if (!accepted) throw new Error("Revert entry has no accepted state");

  const [entry] = await database
    .update(entries)
    .set({
      collectionID: accepted.collectionID,
      deletedAt: null,
      name: accepted.entryName,
      rank,
      updatedAt: new Date()
    })
    .where(and(eq(entries.id, operation.entryID), eq(entries.workspaceID, workspaceID)))
    .returning({
      collectionID: entries.collectionID,
      id: entries.id,
      name: entries.name,
      rank: entries.rank
    });

  if (!entry) throw new Error("Revert entry not found");

  return entry;
};
const deleteEntries = async (
  database: DatabaseTransaction,
  workspaceID: string,
  entryIDs: string[]
): Promise<string[]> => {
  if (entryIDs.length === 0) return [];

  const deleted = await database
    .update(entries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(entries.workspaceID, workspaceID),
        inArray(entries.id, entryIDs),
        isNull(entries.deletedAt)
      )
    )
    .returning({ id: entries.id });

  return deleted.map(({ id }) => id);
};
const deleteCollections = async (
  database: DatabaseTransaction,
  workspaceID: string,
  collectionIDs: string[]
): Promise<{ collectionIDs: string[]; entryIDs: string[] }> => {
  if (collectionIDs.length === 0) return { collectionIDs: [], entryIDs: [] };

  const idList = sql.join(
    collectionIDs.map((collectionID) => sql`${collectionID}::uuid`),
    sql`, `
  );
  const deletedCollections = await database.execute<{ id: string }>(sql`
    with recursive subtree as (
      select id
      from ${collections}
      where workspace_id = ${workspaceID}::uuid
        and id in (${idList})
        and deleted_at is null
      union all
      select child.id
      from ${collections} child
      inner join subtree parent on child.parent_id = parent.id
      where child.workspace_id = ${workspaceID}::uuid
        and child.deleted_at is null
    )
    update ${collections}
    set deleted_at = now(), updated_at = now()
    where workspace_id = ${workspaceID}::uuid
      and deleted_at is null
      and id in (select id from subtree)
    returning id
  `);
  const deletedCollectionIDs = deletedCollections.rows.map(({ id }) => id);

  if (deletedCollectionIDs.length === 0) {
    return { collectionIDs: [], entryIDs: [] };
  }

  const deletedEntries = await database
    .update(entries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(entries.workspaceID, workspaceID),
        inArray(entries.collectionID, deletedCollectionIDs),
        isNull(entries.deletedAt)
      )
    )
    .returning({ id: entries.id });

  return {
    collectionIDs: deletedCollectionIDs,
    entryIDs: deletedEntries.map(({ id }) => id)
  };
};
const clearDeletedCurrentEntries = async (
  database: DatabaseTransaction,
  workspaceID: string,
  entryIDs: string[]
): Promise<void> => {
  if (entryIDs.length === 0) return;

  await database
    .update(memberships)
    .set({ currentEntryID: null, updatedAt: new Date() })
    .where(
      and(eq(memberships.workspaceID, workspaceID), inArray(memberships.currentEntryID, entryIDs))
    );
};
const applyPublishingRevertStructure = async (
  database: DatabaseTransaction,
  workspaceID: string,
  plan: PublishingRevertPlan
): Promise<ApplyPublishingRevertStructureResult> => {
  const ranks = await resolvePublishingRevertRanks(database, workspaceID, plan);
  const schemaRootCollectionIDs = [
    ...plan.dependencyCollectionOperations,
    ...plan.collectionOperations.filter(({ action }) => action === "restore")
  ]
    .filter(({ restoreStructure, restoreVisibility }) => restoreStructure || restoreVisibility)
    .map(({ collectionID }) => collectionID);
  const restoredCollections: RevertedCollection[] = [];
  const restoredEntries: RevertedEntry[] = [];

  for (const operation of plan.dependencyCollectionOperations) {
    restoredCollections.push(
      await restoreCollection(
        database,
        workspaceID,
        operation,
        ranks.collections.get(operation.collectionID) || operation.rank
      )
    );
  }

  for (const operation of plan.collectionOperations) {
    if (operation.action !== "restore") continue;

    restoredCollections.push(
      await restoreCollection(
        database,
        workspaceID,
        operation,
        ranks.collections.get(operation.collectionID) || operation.rank
      )
    );
  }

  for (const operation of plan.entryOperations) {
    if (operation.action !== "restore") continue;

    restoredEntries.push(
      await restoreEntry(
        database,
        workspaceID,
        operation,
        ranks.entries.get(operation.entryID) || operation.accepted!.rank
      )
    );
  }

  const directlyDeletedEntryIDs = await deleteEntries(
    database,
    workspaceID,
    plan.entryOperations.filter(({ action }) => action === "delete").map(({ entryID }) => entryID)
  );
  const deletedCollections = await deleteCollections(
    database,
    workspaceID,
    plan.collectionOperations
      .filter(({ action }) => action === "delete")
      .map(({ collectionID }) => collectionID)
  );
  const deletedEntryIDs = [
    ...new Set([...directlyDeletedEntryIDs, ...deletedCollections.entryIDs])
  ];

  await assertContentTreeNames(database, workspaceID);
  await clearDeletedCurrentEntries(database, workspaceID, deletedEntryIDs);

  if (schemaRootCollectionIDs.length > 0) {
    await createEffectiveSchemaChange({
      database,
      initiatedBy: null,
      preserveEntryContent: true,
      rootCollectionIDs: schemaRootCollectionIDs,
      schemaID: null,
      schemaVersionID: null,
      workspaceID
    });
  }

  return {
    deletedCollectionIDs: deletedCollections.collectionIDs,
    deletedEntryIDs,
    restoredCollections,
    restoredEntries
  };
};

export { applyPublishingRevertStructure };
export type { ApplyPublishingRevertStructureResult, RevertedCollection, RevertedEntry };
