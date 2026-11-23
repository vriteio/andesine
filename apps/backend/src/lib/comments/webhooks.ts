import { type DatabaseClient, type DatabaseTransaction } from "@andesine/server/database";
import { toWorkspaceID } from "@andesine/contracts/primitives";
import {
  createOutboundEvent,
  createWebhookOperation,
  createWebhookRecorder,
  getWebhookEntryContext
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";

interface CommentChangeTarget {
  entryID: string;
  collectionID: string | null;
}
interface CommentChange {
  /** Stable key of the change in its operation, e.g. the comment ID. */
  key: string;
  event: CommentWebhookEvent;
  /** Runs last in the transaction, after the event is recorded; e.g. a live document edit. */
  finalize?: () => Promise<void>;
}

type OutboundEventData = Parameters<typeof createOutboundEvent>[2];
type CommentWebhookEvent = {
  [Data in OutboundEventData as Data["type"]]: Data["type"] extends `comment.${string}`
    ? { type: Data["type"]; data: Omit<Data["data"], "collectionID"> }
    : never;
}[OutboundEventData["type"]];

/**
 * One transaction for comment writes and their webhooks; open no document inside (same lock).
 * Null or [] from `write` records no event and returns false.
 */
const writeCommentChange = async (
  database: DatabaseClient,
  workspaceID: string,
  target: CommentChangeTarget,
  write: (transaction: DatabaseTransaction) => Promise<CommentChange | CommentChange[] | null>
): Promise<boolean> => {
  return database.transaction(async (transaction) => {
    const operation = createWebhookOperation(toWorkspaceID(workspaceID));
    // Locks the workspace before the writes, as webhook producers must.
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database: transaction,
      operation
    });
    const context = getWebhookEntryContext(recorder.before, {
      id: target.entryID,
      collectionID: target.collectionID
    });
    const written = await write(transaction);
    const changes = written ? [written].flat() : [];

    if (!changes.length) return false;

    await recorder.record(
      changes.map(({ key, event }) => ({
        event: createOutboundEvent(operation, key, {
          ...event,
          subject: context.subject,
          data: { ...event.data, collectionID: context.collectionID }
        } as OutboundEventData),
        resources: [{ ...context.subject, before: context.scope, after: context.scope }]
      }))
    );

    for (const { finalize } of changes) await finalize?.();

    return true;
  });
};

export { writeCommentChange };
export type { CommentChange };
