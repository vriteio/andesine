import {
  getContentSnapshot,
  openDocumentContentConnection,
  replaceDocumentContent,
  setPersistedDocumentSchemaRevision,
  type ContentConnection,
  type ContentSnapshot
} from "#backend/collaboration";
import {
  collectionSchemas,
  entryVersions,
  schemaVersions,
  type Collection,
  type Entry
} from "#backend/db";
import { loadCollectionTree, type VersionDetails } from "#backend/lib/data";
import {
  applyPublishingRevertStructure,
  getPublishingRevertAuthorizationActions,
  loadPublishingRevertPlan,
  type PublishingEntryStatus,
  type PublishingRevertEntryOperation,
  type PublishingRevertPlan
} from "#backend/lib/publishing";
import { withAuthorization } from "#backend/lib/policy";
import {
  toCollectionID,
  toEntryID,
  toSchemaID,
  toUUID,
  toVersionID
} from "#backend/lib/primitives";
import {
  loadVersionRevertTargets,
  retainRevertedVersionAssets,
  type VersionRevertTarget
} from "#backend/lib/versioning";
import { commitCreateVersion } from "#backend/services/versions/create";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";

interface RevertPublishingChangesInput {
  all?: boolean;
  channel: string;
  collectionID: string;
  collectionIDs?: string[];
  contributorIDs: string[];
  entryIDs?: string[];
  snapshotID: string;
}
interface RevertPublishingChangesResult {
  collectionOrderUpdates: CollectionOrderUpdate[];
  collectionStates: RevertedCollectionState[];
  contentResetEntryIDs: string[];
  createdVersions: VersionDetails[];
  deletedCollectionIDs: string[];
  deletedEntryIDs: string[];
  entryStates: Entry[];
  movedCollectionIDs: string[];
  movedEntryIDs: string[];
  noOp: boolean;
  publishingCollections: PublishingCollectionStatus[];
  publishingEntries: PublishingEntryStatus[];
  restoredCollectionIDs: string[];
  restoredEntryIDs: string[];
  restoredSchemas: RestoredCollectionSchema[];
  updatedCollectionIDs: string[];
  updatedEntryIDs: string[];
}
interface RestoredCollectionSchema {
  id: string;
  collectionID: string;
  enabled: boolean;
  hasActiveVersion: boolean;
  hasUnappliedChanges: boolean;
}
interface CollectionOrderUpdate {
  parentID: string | null;
  descendants: string[];
}
interface CommitRevertPublishingChangesInput {
  connections: Map<string, ContentConnection>;
  expectedPlan: PublishingRevertPlan;
  request: RevertPublishingChangesInput;
}
interface ReplacedDocument {
  connection: ContentConnection;
  entryID: string;
  snapshot: ContentSnapshot;
  schemaRevisionID: string | null;
}
interface RevertedCollectionState {
  collection: Collection;
  index: number;
  parentID: string | null;
}
interface PublishingCollectionStatus {
  collectionID: string;
  enabled: boolean;
}

const assertRequiredConnections = (
  operations: PublishingRevertEntryOperation[],
  connections: Map<string, ContentConnection>
): void => {
  const connectionsMatch = operations.every(({ entryID }) => connections.has(entryID));

  if (!connectionsMatch) {
    throw new ORPCError("CONFLICT", { message: "Publishing changes changed" });
  }
};
const assertCompatiblePlan = (
  expected: PublishingRevertPlan,
  current: PublishingRevertPlan
): void => {
  const expectedCollectionIDs = new Set(expected.selectedCollectionIDs);
  const expectedEntryIDs = new Set(expected.selectedEntryIDs);
  const expectedDependencyIDs = new Set(expected.dependencyCollectionIDs);
  const hasNewSelection =
    current.selectedCollectionIDs.some((collectionID) => {
      return !expectedCollectionIDs.has(collectionID);
    }) || current.selectedEntryIDs.some((entryID) => !expectedEntryIDs.has(entryID));
  const hasNewDependency = current.dependencyCollectionIDs.some((collectionID) => {
    return !expectedDependencyIDs.has(collectionID);
  });

  if (hasNewSelection || hasNewDependency) {
    throw new ORPCError("CONFLICT", { message: "Publishing changes changed" });
  }
};
const getTargetsByEntryID = async (
  database: Parameters<typeof loadVersionRevertTargets>[0],
  workspaceID: string,
  operations: PublishingRevertEntryOperation[]
): Promise<Map<string, VersionRevertTarget>> => {
  const targets = await loadVersionRevertTargets(
    database,
    workspaceID,
    operations.map((operation) => ({
      entryID: operation.entryID,
      versionID: operation.accepted!.versionID
    }))
  );

  return new Map(targets.map((target) => [target.entryID, target]));
};
const rollbackDocuments = async (documents: ReplacedDocument[]): Promise<void> => {
  for (const document of [...documents].reverse()) {
    try {
      setPersistedDocumentSchemaRevision(document.connection, document.schemaRevisionID);
      await replaceDocumentContent(document.connection, document.snapshot.document);
    } catch (error) {
      console.error("Failed to roll back publishing revert document", {
        error,
        entryID: toEntryID(document.entryID)
      });
    }
  }
};
const disconnectConnections = async (
  connections: Map<string, ContentConnection>
): Promise<void> => {
  await Promise.allSettled(
    [...connections.entries()].map(async ([entryID, connection]) => {
      try {
        await connection.disconnect();
      } catch (error) {
        console.error("Failed to close publishing revert document", {
          error,
          entryID: toEntryID(entryID)
        });
      }
    })
  );
};
const prepareRevertPublishingChanges = withAuthorization<
  RevertPublishingChangesInput,
  PublishingRevertPlan,
  PublishingRevertPlan
>(
  {
    actions: ({ resolved }) => getPublishingRevertAuthorizationActions(resolved),
    includeDeleted: true,
    permissions: { session: true, key: ["read:publishing"] },
    resolve: ({ auth, database, input }) => {
      return loadPublishingRevertPlan(database, auth, input);
    },
    tree: true
  },
  async ({ resolved }) => resolved
);
const commitRevertPublishingChanges = withAuthorization<
  CommitRevertPublishingChangesInput,
  PublishingRevertPlan,
  RevertPublishingChangesResult
>(
  {
    actions: ({ resolved }) => getPublishingRevertAuthorizationActions(resolved),
    includeDeleted: true,
    permissions: { session: true, key: ["read:publishing"] },
    resolve: async ({ auth, database, input }) => {
      const workingContentHashes = new Map<string, string>();

      for (const [entryID, connection] of input.connections) {
        await connection.transact((document) => {
          workingContentHashes.set(entryID, getContentSnapshot(document).hash);
        });
      }

      try {
        return await loadPublishingRevertPlan(database, auth, input.request, workingContentHashes);
      } catch (error) {
        const staleSelection =
          error instanceof ORPCError && ["BAD_REQUEST", "NOT_FOUND"].includes(error.code);

        if (staleSelection) {
          throw new ORPCError("CONFLICT", { message: "Publishing changes changed" });
        }

        throw error;
      }
    },
    transaction: "locked-workspace",
    tree: true
  },
  async ({ auth, authorizationScope, database, input, resolved, workspaceID }) => {
    const contentOperations = resolved.entryOperations.filter(
      ({ restoreContent }) => restoreContent
    );
    const replacedDocuments: ReplacedDocument[] = [];
    const createdVersions: VersionDetails[] = [];

    assertCompatiblePlan(input.expectedPlan, resolved);
    assertRequiredConnections(contentOperations, input.connections);

    const targetsByEntryID = await getTargetsByEntryID(database, workspaceID, contentOperations);
    const result = await applyPublishingRevertStructure(database, workspaceID, resolved);
    const collectionTree = await loadCollectionTree(workspaceID, false, database);
    const restoredCollectionOperations = [
      ...resolved.dependencyCollectionOperations,
      ...resolved.collectionOperations.filter(({ action }) => action === "restore")
    ];
    const restoredVisibilityCollectionIDs = restoredCollectionOperations
      .filter(({ restoreVisibility }) => restoreVisibility)
      .map(({ collectionID }) => toCollectionID(collectionID));
    const restoredSchemaRows =
      restoredVisibilityCollectionIDs.length > 0
        ? await database
            .select({
              id: collectionSchemas.id,
              collectionID: collectionSchemas.collectionID,
              draftHash: collectionSchemas.draftHash,
              activeHash: schemaVersions.hash
            })
            .from(collectionSchemas)
            .leftJoin(
              schemaVersions,
              and(
                eq(schemaVersions.workspaceID, collectionSchemas.workspaceID),
                eq(schemaVersions.schemaID, collectionSchemas.id),
                eq(schemaVersions.active, true)
              )
            )
            .where(
              and(
                eq(collectionSchemas.workspaceID, workspaceID),
                inArray(
                  collectionSchemas.collectionID,
                  restoredVisibilityCollectionIDs.map(toUUID)
                ),
                eq(collectionSchemas.enabled, true)
              )
            )
        : [];

    try {
      for (const operation of contentOperations) {
        const connection = input.connections.get(operation.entryID)!;
        const target = targetsByEntryID.get(operation.entryID);

        if (!target) {
          throw new ORPCError("CONFLICT", { message: "Published entry version changed" });
        }

        await retainRevertedVersionAssets(database, workspaceID, {
          entryID: operation.entryID,
          versionID: target.versionID
        });

        const previous = await replaceDocumentContent(connection, target.document);

        setPersistedDocumentSchemaRevision(connection, target.schemaRevisionID);
        replacedDocuments.push({
          connection,
          entryID: operation.entryID,
          snapshot: previous,
          schemaRevisionID: operation.workingSchemaRevisionID
        });

        const [existing] = await database
          .select({ id: entryVersions.id })
          .from(entryVersions)
          .where(
            and(
              eq(entryVersions.workspaceID, workspaceID),
              eq(entryVersions.entryID, operation.entryID),
              eq(entryVersions.hash, previous.hash),
              operation.workingSchemaRevisionID
                ? eq(entryVersions.schemaRevisionID, operation.workingSchemaRevisionID)
                : isNull(entryVersions.schemaRevisionID)
            )
          )
          .limit(1);
        const entryID = toEntryID(operation.entryID);

        if (!existing) {
          const safetyVersion = await commitCreateVersion({
            auth,
            contributorIDs: input.request.contributorIDs,
            entryID,
            reason: "auto",
            schemaRevisionID: operation.workingSchemaRevisionID,
            skipAuthorization: authorizationScope,
            snapshot: previous
          });

          createdVersions.push(safetyVersion);
        }

        const version = await commitCreateVersion({
          auth,
          contributorIDs: input.request.contributorIDs,
          entryID,
          reason: "revert",
          schemaRevisionID: target.schemaRevisionID,
          skipAuthorization: authorizationScope,
          snapshot: { document: target.document, hash: target.hash },
          sourceVersionID: toVersionID(target.versionID)
        });

        createdVersions.push(version);
      }
    } catch (error) {
      await rollbackDocuments(replacedDocuments);
      throw error;
    }

    const restoredVisibilityEntryIDs = resolved.entryOperations
      .filter(({ restoreVisibility }) => restoreVisibility)
      .map(({ entryID }) => toEntryID(entryID));
    const movedCollectionIDs = restoredCollectionOperations
      .filter(({ restoreStructure, restoreVisibility }) => restoreStructure && !restoreVisibility)
      .map(({ collectionID }) => toCollectionID(collectionID));
    const movedEntryIDs = resolved.entryOperations
      .filter(({ action, restoreStructure, restoreVisibility }) => {
        return action === "restore" && restoreStructure && !restoreVisibility;
      })
      .map(({ entryID }) => toEntryID(entryID));
    const updatedCollectionIDs = restoredCollectionOperations
      .filter((operation) => {
        const restoreMetadata = "restoreMetadata" in operation && operation.restoreMetadata;

        return (
          (restoreMetadata || operation.restorePublishingEnabled) && !operation.restoreVisibility
        );
      })
      .map(({ collectionID }) => toCollectionID(collectionID));
    const updatedEntryIDs = resolved.entryOperations
      .filter(({ action, restoreContent, restoreName, restoreVisibility }) => {
        return action === "restore" && (restoreContent || restoreName) && !restoreVisibility;
      })
      .map(({ entryID }) => toEntryID(entryID));
    const contentResetEntryIDs = contentOperations.map(({ entryID }) => toEntryID(entryID));
    const entryStates = result.restoredEntries.map(({ collectionID, id, name, rank }): Entry => ({
      id: toEntryID(id),
      name,
      order: rank,
      ...(collectionID && { collectionID: toCollectionID(collectionID) })
    }));
    const collectionsByID = new Map(
      collectionTree.collections.map((collection) => [collection.id, collection])
    );
    const root = collectionTree.rows.find(({ parentID }) => !parentID);
    const rootCollection = root ? collectionsByID.get(toCollectionID(root.id)) : undefined;
    const collectionStates = result.restoredCollections.flatMap(({ id }) => {
      const collection = collectionsByID.get(toCollectionID(id));

      if (!collection) return [];

      const parentID = collection.ancestors[collection.ancestors.length - 1] || null;
      const parent = parentID ? collectionsByID.get(parentID) : rootCollection;

      return [
        {
          collection,
          index: Math.max(parent?.descendants.indexOf(collection.id) ?? 0, 0),
          parentID
        }
      ];
    });
    const reorderedCollectionIDs = new Set([
      ...movedCollectionIDs,
      ...restoredVisibilityCollectionIDs
    ]);
    const reorderedParentIDs = new Set(
      collectionStates
        .filter(({ collection }) => reorderedCollectionIDs.has(collection.id))
        .map(({ parentID }) => parentID || rootCollection?.id)
    );
    const collectionOrderUpdates = collectionTree.collections
      .filter(({ id }) => reorderedParentIDs.has(id))
      .map(({ id, descendants }) => ({
        parentID: id === rootCollection?.id ? null : id,
        descendants
      }));
    const restoredOperationsByEntryID = new Map(
      resolved.entryOperations
        .filter(({ action }) => action === "restore")
        .map((operation) => [operation.entryID, operation])
    );

    return {
      collectionOrderUpdates,
      collectionStates,
      contentResetEntryIDs,
      createdVersions,
      deletedCollectionIDs: result.deletedCollectionIDs.map(toCollectionID),
      deletedEntryIDs: result.deletedEntryIDs.map(toEntryID),
      entryStates,
      movedCollectionIDs,
      movedEntryIDs,
      noOp:
        resolved.collectionOperations.length === 0 &&
        resolved.dependencyCollectionOperations.length === 0 &&
        resolved.entryOperations.length === 0,
      publishingCollections: [
        ...resolved.dependencyCollectionOperations,
        ...resolved.collectionOperations.filter(
          ({ action, restorePublishingEnabled, restoreVisibility }) => {
            return action === "restore" && (restorePublishingEnabled || restoreVisibility);
          }
        )
      ].map(({ collectionID, publishingEnabled }) => ({
        collectionID: toCollectionID(collectionID),
        enabled: publishingEnabled
      })),
      publishingEntries: [
        ...result.restoredEntries.map(({ id }) => {
          const operation = restoredOperationsByEntryID.get(id);

          return {
            entryID: toEntryID(id),
            hasUnpublishedChanges: false,
            versionID: operation?.accepted?.versionID
              ? toVersionID(operation.accepted.versionID)
              : null
          };
        }),
        ...result.deletedEntryIDs.map((id) => ({
          entryID: toEntryID(id),
          hasUnpublishedChanges: false,
          versionID: null
        }))
      ],
      restoredCollectionIDs: restoredVisibilityCollectionIDs,
      restoredEntryIDs: restoredVisibilityEntryIDs,
      restoredSchemas: restoredSchemaRows.map((schema) => ({
        id: toSchemaID(schema.id),
        collectionID: toCollectionID(schema.collectionID),
        enabled: true,
        hasActiveVersion: Boolean(schema.activeHash),
        hasUnappliedChanges: Boolean(schema.draftHash) && schema.draftHash !== schema.activeHash
      })),
      updatedCollectionIDs,
      updatedEntryIDs
    };
  }
);
const revertPublishingChanges = withAuthorization<
  RevertPublishingChangesInput,
  undefined,
  RevertPublishingChangesResult
>({}, async ({ auth, input, workspaceID }) => {
  const plan = await prepareRevertPublishingChanges({ ...input, auth });
  const connections = new Map<string, ContentConnection>();

  try {
    for (const { entryID } of plan.contentEntries) {
      const connection = await openDocumentContentConnection(toEntryID(entryID), workspaceID, {
        includeDeleted: true,
        preserveSchemaRevision: true
      });

      connections.set(entryID, connection);
    }

    return await commitRevertPublishingChanges({
      auth,
      connections,
      expectedPlan: plan,
      request: input
    });
  } finally {
    await disconnectConnections(connections);
  }
});

export { revertPublishingChanges };
export type { RevertPublishingChangesInput, RevertPublishingChangesResult };
