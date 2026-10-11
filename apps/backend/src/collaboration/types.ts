import type { ContentNode } from "@andesine/document";
import type { SessionData } from "#backend/lib/policy";
import type { WebhookActor } from "@andesine/contracts/webhooks";

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
  // The operation's actor; an extension actor's own webhooks skip the save's events.
  webhookActor?: WebhookActor | null;
  workspaceID?: string;
}
interface ContentSnapshot {
  document: ContentNode;
  hash: string;
}
interface ContentState extends ContentSnapshot {
  state: Buffer;
}

export type { CollaborationContext, ContentSnapshot, ContentState };
