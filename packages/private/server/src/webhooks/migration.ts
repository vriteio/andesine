import type { ContentNode } from "@andesine/document";
import { hashContentDocument } from "../content/index";
import { getPublishingContentDocument } from "../publishing/initialize-content";
import { toExtensionID, toWebhookOperationID, toWorkspaceID } from "@andesine/contracts/primitives";
import { schemaMigrations, type DatabaseClient } from "@andesine/server/database";
import { eq } from "drizzle-orm";
import { createWebhookOperation, type WebhookOperation } from "./operation";

/** The migration's operation (`migrationID` is its UUID), with its recorded origin. */
const loadMigrationWebhookOperation = async (
  database: DatabaseClient,
  workspaceID: string,
  migrationID: string
): Promise<WebhookOperation> => {
  const [migration] = await database
    .select({ originExtensionID: schemaMigrations.originExtensionID })
    .from(schemaMigrations)
    .where(eq(schemaMigrations.id, migrationID));
  const origin = migration?.originExtensionID;

  return createWebhookOperation(
    toWorkspaceID(workspaceID),
    toWebhookOperationID(migrationID),
    origin ? toExtensionID(origin) : null
  );
};
const getSavedMigrationContentHash = (document: ContentNode | null, state: Buffer | null): string =>
  hashContentDocument(getPublishingContentDocument({ document, state }));

export { loadMigrationWebhookOperation, getSavedMigrationContentHash };
