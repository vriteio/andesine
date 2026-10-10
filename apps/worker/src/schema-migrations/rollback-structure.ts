import { schemaMigrations, workspaces } from "@andesine/server/database";
import { restoreSchemaEntryMove, restoreSchemaCollectionMove } from "@andesine/server/schema";
import {
  loadMigrationWebhookOperation,
  createStructureWebhookRecorder
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "../config";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../database";

interface FinishMigrationRollbackInput {
  migrationID: string;
  workspaceID: string;
  error: string;
}

const startMigrationRollback = async (input: FinishMigrationRollbackInput): Promise<boolean> => {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceID))
      .for("update");

    const [migration] = await transaction
      .update(schemaMigrations)
      .set({ status: "rolling_back", error: input.error, updatedAt: new Date() })
      .where(
        and(
          eq(schemaMigrations.id, input.migrationID),
          eq(schemaMigrations.workspaceID, input.workspaceID),
          inArray(schemaMigrations.status, ["queued", "running", "rolling_back"])
        )
      )
      .returning({ id: schemaMigrations.id });

    return Boolean(migration);
  });
};
const finishMigrationRollback = async (input: FinishMigrationRollbackInput) => {
  return db.transaction(async (transaction) => {
    await transaction
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, input.workspaceID))
      .for("update");

    const [migration] = await transaction
      .select()
      .from(schemaMigrations)
      .where(
        and(
          eq(schemaMigrations.id, input.migrationID),
          eq(schemaMigrations.workspaceID, input.workspaceID)
        )
      )
      .for("update");

    if (!migration || migration.status !== "rolling_back") {
      return { restoredMove: null, restoredCollectionMove: null };
    }

    const webhooks = await createStructureWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database: transaction,
      workspaceID: input.workspaceID,
      operation: await loadMigrationWebhookOperation(
        transaction,
        input.workspaceID,
        input.migrationID
      ),
      collectionIDs: migration.collectionMove ? [migration.collectionMove.collectionID] : [],
      entryIDs: migration.entryMove ? [migration.entryMove.entryID] : [],
      includeDescendants: true
    });
    const restoredMove = await restoreSchemaEntryMove(
      transaction,
      input.migrationID,
      input.workspaceID
    );
    const restoredCollectionMove = await restoreSchemaCollectionMove(
      transaction,
      input.migrationID,
      input.workspaceID
    );

    await webhooks.record();
    await transaction
      .update(schemaMigrations)
      .set({ status: "failed", error: input.error, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(schemaMigrations.id, input.migrationID));

    return { restoredMove, restoredCollectionMove };
  });
};

export { startMigrationRollback, finishMigrationRollback };
