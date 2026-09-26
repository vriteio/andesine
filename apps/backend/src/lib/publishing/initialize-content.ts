import { contents } from "#backend/db";
import { serializeContentDocument, type ContentNode } from "#backend/lib/content";
import type { DatabaseTransaction as Database } from "#backend/lib/adapters/postgres";
import { recordSavedEntryWebhooks } from "#backend/lib/webhooks/entry-save";
import type { WebhookOperation } from "#backend/lib/webhooks/operation";
import type { WebhookRecorder } from "#backend/lib/webhooks/recorder";
import { applyUpdate, Doc } from "yjs";

interface InitializePublishingContentInput {
  database: Database;
  workspaceID: string;
  entry: { id: string; collectionID: string | null };
  document: ContentNode;
  hash: string;
  schemaRevisionID: string | null;
  contentExists: boolean;
  operation: WebhookOperation;
  recorder: WebhookRecorder;
}

const getPublishingContentDocument = (
  content: Pick<typeof contents.$inferSelect, "document" | "state"> | undefined
): ContentNode => {
  if (content?.document) return content.document;
  if (!content) return { type: "doc", content: [] };

  const document = new Doc();

  try {
    if (content.state) applyUpdate(document, new Uint8Array(content.state));

    return serializeContentDocument(document);
  } finally {
    document.destroy();
  }
};
const initializePublishingContent = async (
  input: InitializePublishingContentInput
): Promise<void> => {
  const savedAt = new Date();
  const { database, document, hash } = input;

  await database
    .insert(contents)
    .values({
      workspaceID: input.workspaceID,
      entryID: input.entry.id,
      document,
      hash,
      updatedAt: savedAt
    })
    .onConflictDoUpdate({ target: contents.entryID, set: { document, hash, updatedAt: savedAt } });

  await recordSavedEntryWebhooks({
    database,
    recorder: input.recorder,
    operation: input.operation,
    entry: { ...input.entry, deletedAt: null },
    document,
    schemaRevisionID: input.schemaRevisionID,
    hash,
    savedAt,
    // Existing rows already expose this document through the public API's Yjs fallback.
    contentChanged: !input.contentExists,
    titleChanged: false
  });
};

export { getPublishingContentDocument, initializePublishingContent };
