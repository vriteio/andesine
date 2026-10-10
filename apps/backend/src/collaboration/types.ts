import type { ContentNode } from "@andesine/document";
import type { SessionData } from "#backend/lib/policy";

interface CollaborationContext {
  auth?: SessionData;
  collectionID?: string;
  contributorID?: string;
  entryID?: string;
  includeDeleted?: boolean;
  persistedSchemaRevisionID?: string | null;
  preserveSchemaRevision?: boolean;
  resource?: "entry" | "schema";
  schemaID?: string;
  schemaMigrationReadOnly?: boolean;
  // Server-side direct operations can link a later persisted save to their event.
  webhookOperationID?: string;
  // The operation's extension origin (`ext_` ID), whose webhooks skip the save's events.
  webhookOriginExtensionID?: string | null;
  workspaceID?: string;
}
interface ContentSnapshot {
  document: ContentNode;
  hash: string;
}

export type { CollaborationContext, ContentSnapshot };
