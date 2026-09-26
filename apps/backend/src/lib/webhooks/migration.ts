import { hashContentDocument, type ContentNode } from "#backend/lib/content";
import { getPublishingContentDocument } from "#backend/lib/publishing/initialize-content";
import { toWebhookOperationID, toWorkspaceID } from "#backend/lib/primitives/id";
import { createWebhookOperation } from "./operation";

const createMigrationWebhookOperation = (workspaceID: string, migrationID: string) =>
  createWebhookOperation(toWorkspaceID(workspaceID), toWebhookOperationID(migrationID));
const getSavedMigrationContentHash = (document: ContentNode | null, state: Buffer | null): string =>
  hashContentDocument(getPublishingContentDocument({ document, state }));

export { createMigrationWebhookOperation, getSavedMigrationContentHash };
