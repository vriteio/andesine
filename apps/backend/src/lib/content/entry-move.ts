import {
  collections,
  contents,
  effectiveSchemaRevisions,
  entries,
  schemaMigrationCollections,
  schemaMigrationEntries,
  schemaMigrations
} from "@andesine/server/database";
import { assertContentNameAvailable } from "@andesine/server/content";
import { type EffectiveSchemaChangePlan } from "@andesine/server/schema";
import {
  createOutboundEvent,
  createWebhookOperation,
  createWebhookRecorder,
  getWebhookEntryContext,
  getWebhookActor
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import {
  rankBetweenNeighbors,
  toEntryID,
  toUUID,
  toWorkspaceID,
  toCollectionID
} from "@andesine/contracts/primitives";
import {
  isCollectionPublishingEnabled,
  loadPublishingTree,
  type PublishingEntryStatus
} from "#backend/lib/publishing";
import { and, desc, eq, gt, inArray, isNull, lt, ne } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { assertExpectedValue } from "./preconditions";
import { resolveCollectionTarget } from "./collection-target";
import { withAuthorization } from "#backend/lib/policy";

interface MoveEntryInput {
  confirmedDataLoss?: boolean;
  id: string;
  order?: string;
  collectionID?: string | null;
  collectionPath?: string;
  collectionSlugPath?: string;
  expectedCollectionID?: string | null;
}
interface MoveEntryResult {
  collectionChanged: boolean;
  /** The parent collection after the move. */
  collectionID: string | null;
  order: string;
  publishingEntries: PublishingEntryStatus[];
  restrictedBoundaryChanged: boolean;
  schemaMigration: EffectiveSchemaChangePlan;
}
interface ResolvedMoveEntry {
  name: string;
  destinationCollectionID: string | null;
  sourceCollectionID: string | null;
  sourceOrder: string;
}

// Recognized by identity, not message.
const dataLossErrors = new WeakSet<object>();

const planEntryMove = withAuthorization<MoveEntryInput, ResolvedMoveEntry, MoveEntryResult>(
  {
    actions: ({ resolved }) => ({
      entries: [
        { action: "entry:move", collectionID: resolved.sourceCollectionID },
        { action: "entry:create", collectionID: resolved.destinationCollectionID }
      ]
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const [entry] = await database
        .select({ collectionID: entries.collectionID, rank: entries.rank, name: entries.name })
        .from(entries)
        .where(
          and(
            eq(entries.id, toUUID(input.id)),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        )
        .for("update");

      if (!entry) throw new ORPCError("NOT_FOUND");

      const target = await resolveCollectionTarget(database, workspaceID, input);
      const destinationCollectionID = target === undefined ? entry.collectionID : target;

      if (destinationCollectionID) {
        const [collection] = await database
          .select({ id: collections.id })
          .from(collections)
          .where(
            and(
              eq(collections.id, destinationCollectionID),
              eq(collections.workspaceID, workspaceID),
              isNull(collections.deletedAt)
            )
          )
          .for("update");

        if (!collection) throw new ORPCError("BAD_REQUEST", { message: "Collection not found" });
      }

      return {
        destinationCollectionID,
        name: entry.name,
        sourceCollectionID: entry.collectionID,
        sourceOrder: entry.rank
      };
    },
    tree: true,
    transaction: "locked-workspace"
  },
  async ({ auth, authorization, database, input, resolved, workspaceID }) => {
    const entryID = toUUID(input.id);
    const { destinationCollectionID, sourceCollectionID } = resolved;

    assertExpectedValue(
      "collectionID",
      input.expectedCollectionID,
      sourceCollectionID ? toCollectionID(sourceCollectionID) : null
    );

    await assertContentNameAvailable(database, workspaceID, {
      kind: "entry",
      id: entryID,
      parentID: destinationCollectionID,
      name: resolved.name
    });

    const publishingTree = await loadPublishingTree(database, workspaceID);
    const wasPublishingEnabled = isCollectionPublishingEnabled(publishingTree, sourceCollectionID);
    const willBePublishingEnabled = isCollectionPublishingEnabled(
      publishingTree,
      destinationCollectionID
    );
    const crossesPublishingBoundary = wasPublishingEnabled !== willBePublishingEnabled;
    const restrictedBoundaryChanged =
      authorization.getRestrictedBoundaryID(sourceCollectionID) !==
      authorization.getRestrictedBoundaryID(destinationCollectionID);

    const siblingFilter = destinationCollectionID
      ? and(
          eq(entries.workspaceID, workspaceID),
          eq(entries.collectionID, destinationCollectionID),
          ne(entries.id, entryID),
          isNull(entries.deletedAt)
        )
      : and(
          eq(entries.workspaceID, workspaceID),
          isNull(entries.collectionID),
          ne(entries.id, entryID),
          isNull(entries.deletedAt)
        );
    const [last] =
      input.order === undefined && sourceCollectionID !== destinationCollectionID
        ? await database
            .select({ rank: entries.rank })
            .from(entries)
            .where(siblingFilter)
            .orderBy(desc(entries.rank))
            .limit(1)
        : [];
    // Without an order, the entry keeps its position, or goes last in a new collection.
    const order =
      input.order ??
      (sourceCollectionID === destinationCollectionID
        ? resolved.sourceOrder
        : rankBetweenNeighbors(last?.rank));
    const [collision] = await database
      .select({ rank: entries.rank })
      .from(entries)
      .where(and(siblingFilter, eq(entries.rank, order)))
      .limit(1);

    let rank = order;

    if (collision) {
      const [lower] = await database
        .select({ rank: entries.rank })
        .from(entries)
        .where(and(siblingFilter, lt(entries.rank, order)))
        .orderBy(desc(entries.rank))
        .limit(1);

      if (lower) {
        rank = rankBetweenNeighbors(lower.rank, order);
      } else {
        const [upper] = await database
          .select({ rank: entries.rank })
          .from(entries)
          .where(and(siblingFilter, gt(entries.rank, order)))
          .orderBy(entries.rank)
          .limit(1);

        rank = rankBetweenNeighbors(order, upper?.rank);
      }
    }

    const positionChanged =
      sourceCollectionID !== destinationCollectionID || resolved.sourceOrder !== rank;
    const operation = createWebhookOperation(toWorkspaceID(workspaceID));
    const recorder = positionChanged
      ? await createWebhookRecorder({
          retentionPolicy: webhookRetentionPolicy,
          database,
          operation
        })
      : null;

    if (positionChanged) {
      await database
        .update(entries)
        .set({
          rank,
          ...(sourceCollectionID !== destinationCollectionID && {
            collectionID: destinationCollectionID
          }),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(entries.id, entryID),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        );
    }

    let schemaMigration: EffectiveSchemaChangePlan = {
      affectedCollectionIDs: [],
      migrationID: null,
      totalEntries: 0
    };

    if (sourceCollectionID !== destinationCollectionID) {
      const revisionCollectionIDs = [sourceCollectionID, destinationCollectionID].filter(
        (collectionID): collectionID is string => Boolean(collectionID)
      );
      const revisionRows =
        revisionCollectionIDs.length > 0
          ? await database
              .select()
              .from(effectiveSchemaRevisions)
              .where(
                and(
                  eq(effectiveSchemaRevisions.workspaceID, workspaceID),
                  inArray(effectiveSchemaRevisions.collectionID, revisionCollectionIDs),
                  eq(effectiveSchemaRevisions.active, true)
                )
              )
          : [];
      const sourceRevision = revisionRows.find(
        ({ collectionID }) => collectionID === sourceCollectionID
      );
      const targetRevision = revisionRows.find(
        ({ collectionID }) => collectionID === destinationCollectionID
      );
      const [content] = await database
        .select({
          hash: contents.hash,
          schemaRevisionID: contents.schemaRevisionID
        })
        .from(contents)
        .where(eq(contents.entryID, entryID));
      const alreadyMatchesTarget = content?.schemaRevisionID === targetRevision?.id;
      const schemasHaveSameContent = Boolean(
        sourceRevision &&
        targetRevision &&
        content?.schemaRevisionID === sourceRevision.id &&
        sourceRevision.hash === targetRevision.hash
      );

      if (!targetRevision) {
        await database
          .update(contents)
          .set({ schemaRevisionID: null, updatedAt: new Date() })
          .where(eq(contents.entryID, entryID));
      } else if (alreadyMatchesTarget || schemasHaveSameContent) {
        await database
          .update(contents)
          .set({ schemaRevisionID: targetRevision.id, updatedAt: new Date() })
          .where(eq(contents.entryID, entryID));
      } else {
        if (!input.confirmedDataLoss) {
          const error = new ORPCError("PRECONDITION_FAILED", {
            message: "Schema migrations require explicit data-loss confirmation",
            data: {
              hints: [
                "Review the affected content first. Set confirmedDataLoss to true only after accepting the possible data loss."
              ]
            }
          });

          dataLossErrors.add(error);
          throw error;
        }

        const [migration] = await database
          .insert(schemaMigrations)
          .values({
            workspaceID,
            status: "queued",
            entryMove: {
              entryID,
              sourceCollectionID,
              sourceOrder: resolved.sourceOrder
            },
            initiatedBy: auth.session?.memberID ? toUUID(auth.session.memberID) : null,
            webhookActor: getWebhookActor(),
            totalEntries: 1
          })
          .returning();

        await database.insert(schemaMigrationCollections).values({
          workspaceID,
          migrationID: migration.id,
          collectionID: targetRevision.collectionID,
          sourceRevisionID: targetRevision.id,
          targetRevisionID: targetRevision.id
        });
        if (sourceCollectionID) {
          await database.insert(schemaMigrationCollections).values({
            workspaceID,
            migrationID: migration.id,
            collectionID: sourceCollectionID,
            sourceRevisionID: sourceRevision?.id || null,
            targetRevisionID: sourceRevision?.id || null
          });
        }

        await database.insert(schemaMigrationEntries).values({
          workspaceID,
          migrationID: migration.id,
          entryID,
          sourceRevisionID: content?.schemaRevisionID || null,
          targetRevisionID: targetRevision.id,
          sourceHash: content?.hash || null
        });

        schemaMigration = {
          affectedCollectionIDs: revisionCollectionIDs,
          migrationID: migration.id,
          totalEntries: 1
        };
      }
    }

    if (recorder) {
      const before = getWebhookEntryContext(recorder.before, {
        id: entryID,
        collectionID: sourceCollectionID
      });
      const after = getWebhookEntryContext(recorder.before, {
        id: entryID,
        collectionID: destinationCollectionID
      });

      await recorder.record([
        {
          event: createOutboundEvent(operation, "moved", {
            type: "entry.moved",
            subject: before.subject,
            data: {
              scopeTransition: "within",
              reason: sourceCollectionID === destinationCollectionID ? "reordered" : "direct",
              from: {
                visibility: "visible",
                parentID: before.collectionID,
                order: resolved.sourceOrder
              },
              to: { visibility: "visible", parentID: after.collectionID, order: rank }
            }
          }),
          resources: [{ ...before.subject, before: before.scope, after: after.scope }]
        }
      ]);
    }

    return {
      collectionChanged: sourceCollectionID !== destinationCollectionID,
      collectionID: destinationCollectionID ? toCollectionID(destinationCollectionID) : null,
      order: rank,
      publishingEntries: crossesPublishingBoundary
        ? [
            {
              entryID: toEntryID(entryID),
              hasUnpublishedChanges: true,
              versionID: null
            }
          ]
        : [],
      restrictedBoundaryChanged,
      schemaMigration
    };
  }
);

const isDataLossConfirmationError = (error: unknown): boolean => {
  return error instanceof ORPCError && dataLossErrors.has(error);
};

export { isDataLossConfirmationError, planEntryMove };
export type { MoveEntryInput, MoveEntryResult };
