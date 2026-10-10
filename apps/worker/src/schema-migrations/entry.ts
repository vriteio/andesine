import {
  workspaces,
  effectiveSchemaRevisions,
  schemaMigrationEntries,
  schemaMigrations,
  contents,
  entries,
  entryVersionActivity,
  entryVersionActivityContributors,
  entryVersionContributors,
  entryVersions
} from "@andesine/server/database";
import { storeVersionProperties } from "@andesine/server/versioning";
import { retainVersionAssets, syncEntryAssets } from "@andesine/server/assets";
import { hashContentDocument } from "@andesine/server/content";
import {
  createWebhookRecorder,
  recordSavedEntryWebhooks,
  loadMigrationWebhookOperation,
  getSavedMigrationContentHash
} from "@andesine/server/webhooks/recording";
import {
  migrateSchemaContentState,
  replaceSchemaContentState,
  getResolvedSchemaDefinition
} from "@andesine/server/schema";
import { webhookRetentionPolicy } from "../config";
import type { ContentNode } from "@andesine/document";
import { toEntryID } from "@andesine/contracts/primitives";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../database";

interface MigrationEntryInput {
  entryID: string;
  migrationID: string;
  workspaceID: string;
}
interface ProcessMigrationEntryResult {
  changed: boolean;
  entryID: string;
  processed: boolean;
}

const createEmptyDocument = (name: string): ContentNode => ({
  type: "doc",
  content: [
    { type: "title", content: name ? [{ type: "text", text: name }] : undefined },
    { type: "paragraph" }
  ]
});
const processMigrationEntry = async (
  input: MigrationEntryInput
): Promise<ProcessMigrationEntryResult> => {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceID))
      .for("update");
    const [row] = await transaction
      .select({
        entryName: entries.name,
        collectionID: entries.collectionID,
        deletedAt: entries.deletedAt,
        contentEntryID: contents.entryID,
        migrationStatus: schemaMigrations.status,
        initiatedBy: schemaMigrations.initiatedBy,
        entryStatus: schemaMigrationEntries.status,
        document: contents.document,
        state: contents.state,
        schemaRevisionID: contents.schemaRevisionID,
        targetRevisionID: schemaMigrationEntries.targetRevisionID,
        targetDefinition: effectiveSchemaRevisions.definition
      })
      .from(schemaMigrationEntries)
      .innerJoin(
        schemaMigrations,
        and(
          eq(schemaMigrations.workspaceID, schemaMigrationEntries.workspaceID),
          eq(schemaMigrations.id, schemaMigrationEntries.migrationID)
        )
      )
      .innerJoin(
        entries,
        and(
          eq(entries.workspaceID, schemaMigrationEntries.workspaceID),
          eq(entries.id, schemaMigrationEntries.entryID)
        )
      )
      .leftJoin(contents, eq(contents.entryID, schemaMigrationEntries.entryID))
      .innerJoin(
        effectiveSchemaRevisions,
        eq(effectiveSchemaRevisions.id, schemaMigrationEntries.targetRevisionID)
      )
      .where(
        and(
          eq(schemaMigrationEntries.workspaceID, input.workspaceID),
          eq(schemaMigrationEntries.migrationID, input.migrationID),
          eq(schemaMigrationEntries.entryID, input.entryID)
        )
      )
      .for("update", { of: [schemaMigrationEntries, entries] });

    if (!row || row.migrationStatus !== "running" || row.entryStatus !== "queued") {
      return { changed: false, entryID: input.entryID, processed: false };
    }

    if (!row.targetRevisionID) throw new Error("Schema migration target revision is missing");

    const operation = await loadMigrationWebhookOperation(
      transaction,
      input.workspaceID,
      input.migrationID
    );
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database: transaction,
      operation
    });
    const sourceDocument = row.document || createEmptyDocument(row.entryName);
    const migrated = migrateSchemaContentState({
      document: sourceDocument,
      schema: getResolvedSchemaDefinition(row.targetDefinition),
      state: row.state
    });
    const contentChanged =
      row.contentEntryID === null ||
      getSavedMigrationContentHash(row.document, row.state) !== migrated.hash;
    const savedAt = new Date();
    const activityContributors = await transaction
      .select({ membershipID: entryVersionActivityContributors.membershipID })
      .from(entryVersionActivityContributors)
      .where(eq(entryVersionActivityContributors.entryID, input.entryID));
    const contributorIDs = [
      ...new Set([
        ...activityContributors.map(({ membershipID }) => membershipID),
        ...(row.initiatedBy ? [row.initiatedBy] : [])
      ])
    ];
    const [recoveryVersion] = await transaction
      .insert(entryVersions)
      .values({
        workspaceID: input.workspaceID,
        entryID: input.entryID,
        entryName: row.entryName,
        document: migrated.previousDocument,
        hash: migrated.previousHash,
        schemaRevisionID: row.schemaRevisionID,
        reason: "schema-migration"
      })
      .returning({ id: entryVersions.id });

    await storeVersionProperties({
      database: transaction,
      workspaceID: input.workspaceID,
      versionID: recoveryVersion.id,
      document: migrated.previousDocument
    });

    await retainVersionAssets({
      database: transaction,
      workspaceID: input.workspaceID,
      entryID: input.entryID,
      versionID: recoveryVersion.id,
      document: migrated.previousDocument
    });

    const imageReferences = await syncEntryAssets({
      database: transaction,
      workspaceID: input.workspaceID,
      entryID: input.entryID,
      document: migrated.document
    });

    if (imageReferences.changed) throw new Error("Schema content contains an unauthorized image");

    if (contributorIDs.length > 0) {
      await transaction.insert(entryVersionContributors).values(
        contributorIDs.map((membershipID) => ({
          workspaceID: input.workspaceID,
          versionID: recoveryVersion.id,
          membershipID
        }))
      );
    }

    await transaction
      .insert(contents)
      .values({
        workspaceID: input.workspaceID,
        entryID: input.entryID,
        state: migrated.state,
        document: migrated.document,
        hash: migrated.hash,
        schemaRevisionID: row.targetRevisionID,
        updatedAt: savedAt
      })
      .onConflictDoUpdate({
        target: contents.entryID,
        set: {
          state: migrated.state,
          document: migrated.document,
          hash: migrated.hash,
          schemaRevisionID: row.targetRevisionID,
          updatedAt: savedAt
        }
      });
    await transaction
      .delete(entryVersionActivity)
      .where(eq(entryVersionActivity.entryID, input.entryID));
    await transaction
      .update(schemaMigrationEntries)
      .set({
        status: "completed",
        contentLost: migrated.contentLost,
        recoveryVersionID: recoveryVersion.id,
        sourceHash: migrated.previousHash,
        targetHash: migrated.hash,
        error: null,
        startedAt: new Date(),
        completedAt: new Date()
      })
      .where(
        and(
          eq(schemaMigrationEntries.migrationID, input.migrationID),
          eq(schemaMigrationEntries.entryID, input.entryID)
        )
      );
    await transaction
      .update(schemaMigrations)
      .set({
        processedEntries: sql`${schemaMigrations.processedEntries} + 1`,
        updatedAt: new Date()
      })
      .where(eq(schemaMigrations.id, input.migrationID));

    await recordSavedEntryWebhooks({
      database: transaction,
      recorder,
      operation,
      itemKey: `${toEntryID(input.entryID)}:apply`,
      entry: { id: input.entryID, collectionID: row.collectionID, deletedAt: row.deletedAt },
      document: migrated.document,
      schemaRevisionID: row.targetRevisionID,
      hash: migrated.hash,
      savedAt,
      contentChanged,
      titleChanged: false
    });

    return {
      changed: contentChanged,
      entryID: input.entryID,
      processed: true
    };
  });
};
const rollbackMigrationEntry = async (input: MigrationEntryInput): Promise<void> => {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceID))
      .for("update");
    const [row] = await transaction
      .select({
        contentState: contents.state,
        contentDocument: contents.document,
        collectionID: entries.collectionID,
        deletedAt: entries.deletedAt,
        migrationStatus: schemaMigrations.status,
        entryStatus: schemaMigrationEntries.status,
        recoveryDocument: entryVersions.document,
        recoveryRevisionID: entryVersions.schemaRevisionID
      })
      .from(schemaMigrationEntries)
      .innerJoin(schemaMigrations, eq(schemaMigrations.id, schemaMigrationEntries.migrationID))
      .innerJoin(entries, eq(entries.id, schemaMigrationEntries.entryID))
      .innerJoin(entryVersions, eq(entryVersions.id, schemaMigrationEntries.recoveryVersionID))
      .innerJoin(contents, eq(contents.entryID, schemaMigrationEntries.entryID))
      .where(
        and(
          eq(schemaMigrationEntries.workspaceID, input.workspaceID),
          eq(schemaMigrationEntries.migrationID, input.migrationID),
          eq(schemaMigrationEntries.entryID, input.entryID)
        )
      )
      .for("update");

    if (!row) throw new Error("Schema migration recovery content is missing");
    if (row.entryStatus !== "completed" || row.migrationStatus !== "rolling_back") return;

    const operation = await loadMigrationWebhookOperation(
      transaction,
      input.workspaceID,
      input.migrationID
    );
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database: transaction,
      operation
    });
    const restored = replaceSchemaContentState(row.contentState, row.recoveryDocument);
    const hash = hashContentDocument(restored.document);
    const contentChanged =
      getSavedMigrationContentHash(row.contentDocument, row.contentState) !== hash;
    const savedAt = new Date();
    const imageReferences = await syncEntryAssets({
      database: transaction,
      workspaceID: input.workspaceID,
      entryID: input.entryID,
      document: restored.document,
      recoveryDocument: row.recoveryDocument
    });

    if (imageReferences.changed) throw new Error("Recovery image is not available");

    await transaction
      .update(contents)
      .set({
        state: restored.state,
        document: restored.document,
        hash,
        schemaRevisionID: row.recoveryRevisionID,
        updatedAt: savedAt
      })
      .where(eq(contents.entryID, input.entryID));
    await transaction
      .update(schemaMigrationEntries)
      .set({
        status: "rolled_back",
        targetHash: hash,
        completedAt: new Date()
      })
      .where(
        and(
          eq(schemaMigrationEntries.migrationID, input.migrationID),
          eq(schemaMigrationEntries.entryID, input.entryID)
        )
      );

    await recordSavedEntryWebhooks({
      database: transaction,
      recorder,
      operation,
      itemKey: `${toEntryID(input.entryID)}:rollback`,
      entry: { id: input.entryID, collectionID: row.collectionID, deletedAt: row.deletedAt },
      document: restored.document,
      schemaRevisionID: row.recoveryRevisionID,
      hash,
      savedAt,
      contentChanged,
      titleChanged: false
    });
  });
};

export { processMigrationEntry, rollbackMigrationEntry };
export type { ProcessMigrationEntryResult };
