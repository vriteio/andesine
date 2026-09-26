import type { ContentNode } from "@andesine/document";
import { hashContentDocument } from "../content/index";
import { getPublishingContentDocument } from "../publishing/initialize-content";
import { toWebhookOperationID, toWorkspaceID } from "@andesine/contracts/primitives";
import { createWebhookOperation } from "./operation";

const createMigrationWebhookOperation = (workspaceID: string, migrationID: string) =>
  createWebhookOperation(toWorkspaceID(workspaceID), toWebhookOperationID(migrationID));
const getSavedMigrationContentHash = (document: ContentNode | null, state: Buffer | null): string =>
  hashContentDocument(getPublishingContentDocument({ document, state }));

export { createMigrationWebhookOperation, getSavedMigrationContentHash };
