import type { ContentNode } from "#backend/lib/content";
import type { DatabaseTransaction as Database } from "#backend/lib/adapters/postgres";
import { assertRecordedContent } from "#backend/lib/schema/recorded";
import { toUUID } from "#backend/lib/primitives/id";
import { getWebhookEntryContext } from "./entry-context";
import { createOutboundEvent, type WebhookOperation } from "./operation";
import type { WebhookRecorder } from "./recorder";
import type { WebhookEventChange } from "./recording-context";

interface RecordSavedEntryWebhooksInput {
  database: Database;
  recorder: WebhookRecorder;
  operation: WebhookOperation;
  entry: { id: string; collectionID: string | null; deletedAt: Date | null };
  document: ContentNode;
  schemaRevisionID: string | null;
  hash: string;
  savedAt: Date;
  contentChanged: boolean;
  titleChanged: boolean;
  itemKey?: string;
}

// Call after the normalized content/title writes, in their existing transaction.
const recordSavedEntryWebhooks = async (input: RecordSavedEntryWebhooksInput): Promise<void> => {
  const { database, recorder, operation, entry, hash, savedAt, contentChanged, titleChanged } =
    input;
  const changes: WebhookEventChange[] = [];

  if (entry.deletedAt !== null || (!contentChanged && !titleChanged)) return;

  const context = getWebhookEntryContext(recorder.before, entry);
  const resources = [{ ...context.subject, before: context.scope, after: context.scope }];

  if (contentChanged) {
    // Match the public read validator. Failure rolls back content and event writes.
    await assertRecordedContent(database, toUUID(operation.workspaceID), {
      document: input.document,
      entryID: entry.id,
      schemaRevisionID: input.schemaRevisionID
    });
    changes.push({
      event: createOutboundEvent(
        operation,
        input.itemKey ?? "content-saved",
        {
          type: "entry.content_saved",
          subject: context.subject,
          data: {
            collectionID: context.collectionID,
            contentHash: hash,
            savedAt: savedAt.toISOString()
          }
        },
        savedAt
      ),
      resources
    });
  }

  if (titleChanged) {
    changes.push({
      event: createOutboundEvent(
        operation,
        input.itemKey ? `${input.itemKey}:title` : "saved-title",
        {
          type: "entry.updated",
          subject: context.subject,
          data: { collectionID: context.collectionID, changedFields: ["name"] }
        },
        savedAt
      ),
      resources
    });
  }

  await recorder.record(changes);
};

export { recordSavedEntryWebhooks };
