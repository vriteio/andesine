import {
  workspaces,
  contents,
  effectiveSchemaRevisions,
  entries,
  entryVersions,
  publishingChannels,
  publishingSnapshotEntries,
  schemaMigrationEntries,
  schemaMigrations
} from "@andesine/server/database";
import {
  assertContentNameAvailable,
  hashContentDocument,
  replaceContentDocument,
  serializeContentDocument
} from "@andesine/server/content";
import { syncEntryAssets } from "@andesine/server/assets";
import {
  getResolvedSchemaDefinition,
  migrateContentToSchema,
  removeContentSchema
} from "@andesine/server/schema";
import {
  createWebhookOperation,
  createWebhookRecorder,
  recordSavedEntryWebhooks
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import { normalizeContentElements } from "@andesine/document";
import { ORPCError } from "@orpc/server";
import { config } from "#backend/lib/config";
import { db } from "#backend/lib/adapters";
import { PUBLISHED_CHANNEL_CODE } from "@andesine/contracts/publishing";
import { toEntryID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { clearPendingContributors, getPendingContributors } from "./activity";
import { getDocumentTitle, setDocumentTitle } from "./document";
import { emitStoredEntryUpdates } from "./entry-events";
import type { CollaborationContext } from "./types";
import { recordVersionActivity } from "./version-activity";

interface FetchEntryDocumentInput {
  documentName: string;
  context: CollaborationContext;
}
interface StoreEntryDocumentInput {
  documentName: string;
  lastContext: CollaborationContext;
  state: Uint8Array;
}

/** The entry's collaboration state; content saved without a schema loses schema elements. */
const fetchEntryDocument = async ({
  documentName,
  context
}: FetchEntryDocumentInput): Promise<Uint8Array | null> => {
  const workspaceID = toUUID(context.workspaceID!);

  try {
    const [content] = await db
      .select({
        state: contents.state,
        name: entries.name,
        schemaRevisionID: contents.schemaRevisionID
      })
      .from(contents)
      .innerJoin(entries, eq(entries.id, contents.entryID))
      .where(
        and(
          eq(contents.entryID, toUUID(documentName)),
          eq(entries.workspaceID, workspaceID),
          context.includeDeleted ? undefined : isNull(entries.deletedAt)
        )
      )
      .limit(1);

    if (content?.state) {
      if (content.schemaRevisionID) return new Uint8Array(content.state);

      const document = new Doc();

      applyUpdate(document, new Uint8Array(content.state));

      const unrestrictedContent = removeContentSchema(serializeContentDocument(document));

      if (!unrestrictedContent.changed) return new Uint8Array(content.state);

      replaceContentDocument(document, unrestrictedContent.document);

      return encodeStateAsUpdate(document);
    }

    if (content) {
      const document = new Doc();

      setDocumentTitle(document, content.name);

      return encodeStateAsUpdate(document);
    }

    return null;
  } catch (error) {
    console.error("Collaboration database initialization failed", { error });
    throw error;
  }
};
/** Saves the merged state normalized for the active schema, with its webhooks and activity. */
const storeEntryDocument = async ({
  documentName,
  lastContext,
  state
}: StoreEntryDocumentInput): Promise<void> => {
  const entryID = toUUID(documentName);
  const workspaceID = toUUID(lastContext.workspaceID!);
  const pendingContributorIDs = getPendingContributors(documentName);
  const contributorIDs = pendingContributorIDs.map(toUUID);
  const webhookOperationID = lastContext.webhookOperationID;
  const webhookOriginExtensionID = webhookOperationID
    ? (lastContext.webhookOriginExtensionID ?? null)
    : null;
  const stored = await db.transaction(async (tx) => {
    const [workspace] = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceID), isNull(workspaces.deletingAt)))
      .for("update");

    if (!workspace) return null;

    const [entry] = await tx
      .select({
        id: entries.id,
        collectionID: entries.collectionID,
        workspaceID: entries.workspaceID,
        name: entries.name,
        deletedAt: entries.deletedAt
      })
      .from(entries)
      .where(
        and(
          eq(entries.id, entryID),
          eq(entries.workspaceID, workspaceID),
          lastContext.includeDeleted ? undefined : isNull(entries.deletedAt)
        )
      )
      .for("update");

    if (!entry) return null;

    const [activeMigration] = entry.collectionID
      ? await tx
          .select({
            entryStatus: schemaMigrationEntries.status,
            jobID: schemaMigrations.jobID,
            status: schemaMigrations.status
          })
          .from(schemaMigrationEntries)
          .innerJoin(
            schemaMigrations,
            and(
              eq(schemaMigrations.workspaceID, schemaMigrationEntries.workspaceID),
              eq(schemaMigrations.id, schemaMigrationEntries.migrationID)
            )
          )
          .where(
            and(
              eq(schemaMigrationEntries.workspaceID, workspaceID),
              eq(schemaMigrationEntries.entryID, entry.id),
              inArray(schemaMigrations.status, ["queued", "running", "rolling_back"])
            )
          )
          .limit(1)
      : [];
    const preparingMigration =
      activeMigration?.status === "queued" &&
      activeMigration.jobID === null &&
      activeMigration.entryStatus === "queued";
    const hasPersistedSchemaRevision = lastContext.persistedSchemaRevisionID !== undefined;
    const preserveSchemaRevision = hasPersistedSchemaRevision || lastContext.preserveSchemaRevision;

    if (activeMigration && !preparingMigration) return null;

    const operation = createWebhookOperation(
      toWorkspaceID(workspaceID),
      webhookOperationID,
      webhookOriginExtensionID
    );
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database: tx,
      operation
    });

    // Preserve pending edits until the worker saves the recovery version. A move has
    // already changed the collection, so its active schema can be the destination schema.
    const [activeRevision] =
      entry.collectionID && !preparingMigration && !preserveSchemaRevision
        ? await tx
            .select({
              definition: effectiveSchemaRevisions.definition,
              id: effectiveSchemaRevisions.id
            })
            .from(effectiveSchemaRevisions)
            .where(
              and(
                eq(effectiveSchemaRevisions.workspaceID, workspaceID),
                eq(effectiveSchemaRevisions.collectionID, entry.collectionID),
                eq(effectiveSchemaRevisions.active, true)
              )
            )
            .limit(1)
        : [];

    const [content] = await tx
      .select({
        state: contents.state,
        document: contents.document,
        schemaRevisionID: contents.schemaRevisionID,
        hash: contents.hash,
        publishedHash: entryVersions.hash,
        publishedVersionID: publishingSnapshotEntries.versionID
      })
      .from(contents)
      .leftJoin(
        publishingChannels,
        and(
          eq(publishingChannels.workspaceID, workspaceID),
          eq(publishingChannels.code, PUBLISHED_CHANNEL_CODE),
          isNull(publishingChannels.deletedAt)
        )
      )
      .leftJoin(
        publishingSnapshotEntries,
        and(
          eq(publishingSnapshotEntries.entryID, entryID),
          eq(publishingSnapshotEntries.snapshotID, publishingChannels.currentSnapshotID)
        )
      )
      .leftJoin(entryVersions, eq(entryVersions.id, publishingSnapshotEntries.versionID))
      .where(eq(contents.entryID, entryID));
    const persistedDocument = new Doc();

    if (content?.state) applyUpdate(persistedDocument, new Uint8Array(content.state));

    const previousHash =
      content?.hash ??
      hashContentDocument(content?.document ?? serializeContentDocument(persistedDocument));

    applyUpdate(persistedDocument, state);

    // Editors enforce schemas live; saves are normalized here without rewriting the live document.
    const submittedDocument = normalizeContentElements(serializeContentDocument(persistedDocument));
    // Revert inspection connections must not migrate unchanged content on disconnect.
    const normalizedContent = preserveSchemaRevision
      ? { changed: false, document: submittedDocument }
      : activeRevision
        ? migrateContentToSchema({
            defaultMode: "none",
            document: submittedDocument,
            schema: getResolvedSchemaDefinition(activeRevision.definition)
          })
        : preparingMigration
          ? null
          : removeContentSchema(submittedDocument);
    const schemaRevisionID = hasPersistedSchemaRevision
      ? lastContext.persistedSchemaRevisionID
        ? toUUID(lastContext.persistedSchemaRevisionID)
        : null
      : preparingMigration || preserveSchemaRevision
        ? undefined
        : activeRevision?.id || null;

    if (normalizedContent?.changed) {
      replaceContentDocument(persistedDocument, normalizedContent.document);
    }

    const assetContent = await syncEntryAssets({
      database: tx,
      workspaceID,
      entryID,
      restoreUntil: new Date(Date.now() + config.ASSET_UPLOAD_EXPIRY_HOURS * 3600_000),
      document: serializeContentDocument(persistedDocument)
    });

    if (assetContent.changed) replaceContentDocument(persistedDocument, assetContent.document);

    const proposedTitle = getDocumentTitle(persistedDocument);

    let titleRejected = proposedTitle === null;

    if (proposedTitle !== null && proposedTitle !== entry.name) {
      try {
        await assertContentNameAvailable(tx, workspaceID, {
          kind: "entry",
          id: entry.id,
          parentID: entry.collectionID,
          name: proposedTitle
        });
      } catch (error) {
        if (!(error instanceof ORPCError) || error.code !== "CONTENT_NAME_CONFLICT") throw error;

        titleRejected = true;
      }
    }

    // Preserve in-progress title edits in the collaboration state. Correct only the
    // saved content snapshot; the editor restores invalid titles on blur or selection exit.
    const mergedState = encodeStateAsUpdate(persistedDocument);

    if (titleRejected) {
      setDocumentTitle(persistedDocument, entry.name);
    }

    const document = serializeContentDocument(persistedDocument);
    const hash = hashContentDocument(document);
    const title = getDocumentTitle(persistedDocument);
    const contentChanged = previousHash !== hash;
    const titleChanged = entry.deletedAt === null && title !== null && entry.name !== title;
    const savedAt = new Date();
    const publishingEntry = {
      entryID: toEntryID(entry.id),
      matchesPublishedVersion: Boolean(
        content?.publishedVersionID && hash === content.publishedHash
      )
    };

    await tx
      .insert(contents)
      .values({
        entryID,
        workspaceID: entry.workspaceID,
        state: Buffer.from(mergedState),
        document,
        hash,
        ...(schemaRevisionID !== undefined && { schemaRevisionID }),
        updatedAt: savedAt
      })
      .onConflictDoUpdate({
        target: contents.entryID,
        set: {
          state: Buffer.from(mergedState),
          document,
          hash,
          ...(schemaRevisionID !== undefined && { schemaRevisionID }),
          updatedAt: savedAt
        }
      });

    await recordVersionActivity(tx, {
      entryID,
      workspaceID: entry.workspaceID,
      contributorIDs,
      contentChanged
    });

    if (titleChanged) {
      await tx
        .update(entries)
        .set({ name: title, updatedAt: savedAt })
        .where(and(eq(entries.id, entryID), isNull(entries.deletedAt)));
    }

    await recordSavedEntryWebhooks({
      database: tx,
      recorder,
      operation,
      entry,
      document,
      schemaRevisionID:
        schemaRevisionID === undefined ? (content?.schemaRevisionID ?? null) : schemaRevisionID,
      hash,
      savedAt,
      contentChanged,
      titleChanged
    });

    return {
      contentChanged,
      contentNormalized: Boolean(normalizedContent?.changed || assetContent.changed),
      entry,
      publishingEntry,
      title: titleChanged ? title : null
    };
  });

  // A direct operation owns one committed save. Do not reuse its identity for
  // later edits if the connection context is retained by a debounced store.
  if (stored && lastContext.webhookOperationID === webhookOperationID) {
    delete lastContext.webhookOperationID;
    delete lastContext.webhookOriginExtensionID;
  }

  clearPendingContributors(documentName, pendingContributorIDs);

  if (stored) emitStoredEntryUpdates(stored);
};

export { fetchEntryDocument, storeEntryDocument };
