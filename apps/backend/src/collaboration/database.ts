import { assertContentNameAvailable } from "#backend/lib/content/names";
import { ORPCError } from "@orpc/server";
import { normalizeContentElements } from "#backend/lib/content/elements";
import { syncEntryAssets } from "#backend/lib/assets/references";
import { config } from "#backend/lib/config";
import {
  workspaces,
  contents,
  effectiveSchemaRevisions,
  entries,
  entryVersionActivity,
  entryVersionActivityContributors,
  entryVersions,
  publishingChannels,
  publishingSnapshotEntries,
  memberships,
  schemaMigrationEntries,
  schemaMigrations
} from "#backend/db";
import { emitEntryEvent, emitPublishingEntryContentUpdates } from "#backend/events";
import { db } from "#backend/lib/adapters";
import {
  hashContentDocument,
  replaceContentDocument,
  serializeContentDocument
} from "#backend/lib/content";
import { PUBLISHED_CHANNEL_CODE } from "#backend/lib/publishing";
import { enqueueCurrentEntrySync } from "#backend/lib/queue";
import { toEntryID, toUUID, toWorkspaceID } from "#backend/lib/primitives";
import {
  getResolvedSchemaDefinition,
  migrateContentToSchema,
  removeContentSchema
} from "#backend/lib/schema";
import {
  AUTOMATIC_VERSION_MAX_PERIOD_MS,
  AUTOMATIC_VERSION_QUIET_PERIOD_MS
} from "#backend/lib/versioning/config";
import { Database } from "@hocuspocus/extension-database";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { clearPendingContributors, getPendingContributors } from "./activity";
import { getDocumentTitle, setDocumentTitle } from "./document";
import { fetchSchemaDocument, storeSchemaDocument } from "./schema-database";

const collaborationDatabase = new Database({
  async fetch({ context, documentName }) {
    if (documentName.startsWith("sch_")) {
      return fetchSchemaDocument({
        documentName,
        workspaceID: context.workspaceID
      });
    }

    const workspaceID = toUUID(context.workspaceID);

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
  },
  async store({ documentName, lastContext, state }) {
    if (documentName.startsWith("sch_")) {
      return storeSchemaDocument({
        documentName,
        state,
        workspaceID: lastContext.workspaceID
      });
    }

    const entryID = toUUID(documentName);
    const workspaceID = toUUID(lastContext.workspaceID);
    const pendingContributorIDs = getPendingContributors(documentName);
    const contributorIDs = pendingContributorIDs.map(toUUID);
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
          name: entries.name
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
      const preserveSchemaRevision =
        hasPersistedSchemaRevision || lastContext.preserveSchemaRevision;

      if (activeMigration && !preparingMigration) return null;

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

      applyUpdate(persistedDocument, state);

      // The editor enforces schemas during editing. The backend normalizes it before saving, never rewriting the live document.
      const submittedDocument = normalizeContentElements(
        serializeContentDocument(persistedDocument)
      );
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
      const contentChanged = content?.hash !== hash;
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
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: contents.entryID,
          set: {
            state: Buffer.from(mergedState),
            document,
            hash,
            ...(schemaRevisionID !== undefined && { schemaRevisionID }),
            updatedAt: new Date()
          }
        });

      if (contentChanged) {
        const now = new Date();

        await tx
          .insert(entryVersionActivity)
          .values({
            entryID,
            workspaceID: entry.workspaceID,
            dueAt: new Date(now.getTime() + AUTOMATIC_VERSION_QUIET_PERIOD_MS),
            firstChangedAt: now,
            lastChangedAt: now
          })
          .onConflictDoUpdate({
            target: entryVersionActivity.entryID,
            set: {
              lastChangedAt: sql`now()`,
              dueAt: sql`least(
                ${entryVersionActivity.firstChangedAt} + ${AUTOMATIC_VERSION_MAX_PERIOD_MS} * interval '1 millisecond',
                now() + ${AUTOMATIC_VERSION_QUIET_PERIOD_MS} * interval '1 millisecond'
              )`
            }
          });
      }

      if (contributorIDs.length > 0) {
        const [activity] = await tx
          .select({ entryID: entryVersionActivity.entryID })
          .from(entryVersionActivity)
          .where(eq(entryVersionActivity.entryID, entryID));

        if (activity) {
          const contributors = await tx
            .select({ id: memberships.id })
            .from(memberships)
            .where(
              and(
                eq(memberships.workspaceID, entry.workspaceID),
                inArray(memberships.id, contributorIDs)
              )
            )
            .for("key share");

          if (contributors.length > 0) {
            await tx
              .insert(entryVersionActivityContributors)
              .values(
                contributors.map(({ id: membershipID }) => ({
                  workspaceID: entry.workspaceID,
                  entryID,
                  membershipID
                }))
              )
              .onConflictDoNothing();
          }
        }
      }

      if (title !== null && entry.name !== title) {
        await tx
          .update(entries)
          .set({ name: title, updatedAt: new Date() })
          .where(and(eq(entries.id, entryID), isNull(entries.deletedAt)));

        return {
          contentChanged,
          contentNormalized: Boolean(normalizedContent?.changed || assetContent.changed),
          entry,
          publishingEntry,
          title
        };
      }

      return {
        contentChanged,
        contentNormalized: Boolean(normalizedContent?.changed || assetContent.changed),
        entry,
        publishingEntry,
        title: null
      };
    });

    clearPendingContributors(documentName, pendingContributorIDs);

    if (stored?.contentNormalized) {
      emitEntryEvent(toWorkspaceID(stored.entry.workspaceID), {
        action: "entry:content-reset",
        data: { id: toEntryID(stored.entry.id) }
      });
    }

    if (stored && stored.title !== null) {
      emitEntryEvent(toWorkspaceID(stored.entry.workspaceID), {
        action: "entry:update",
        data: {
          id: toEntryID(stored.entry.id),
          name: stored.title
        }
      });
    }

    if (stored?.contentChanged) {
      emitPublishingEntryContentUpdates({
        workspaceID: toWorkspaceID(stored.entry.workspaceID),
        entries: [stored.publishingEntry]
      });
    }

    if (stored && (stored.contentChanged || stored.title !== null)) {
      void enqueueCurrentEntrySync({
        workspaceID: toWorkspaceID(stored.entry.workspaceID),
        entryIDs: [toEntryID(stored.entry.id)]
      });
    }
  }
});

export { collaborationDatabase };
