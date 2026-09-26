import { entries, memberships } from "@andesine/server/database";
import {
  createOutboundEvent,
  createWebhookOperation,
  createWebhookRecorder,
  getWebhookEntryContext
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import { toEntryID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  type EntryAuthorizationSource,
  loadEntryAuthorizationSources,
  withAuthorization
} from "#backend/lib/policy";

interface DeleteEntriesInput {
  ids: string[];
}

const deleteEntries = withAuthorization<
  DeleteEntriesInput,
  EntryAuthorizationSource[],
  { entryIDs: string[] }
>(
  {
    actions: ({ resolved }) => ({
      entries: resolved.map(({ collectionID }) => ({ action: "entry:delete", collectionID }))
    }),
    resolve: ({ database, input, workspaceID }) => {
      return loadEntryAuthorizationSources({ database, entryIDs: input.ids, workspaceID });
    },
    transaction: "locked-workspace"
  },
  async ({ database, input, workspaceID }) => {
    if (input.ids.length === 0) return { entryIDs: [] };

    const entryIDs = [...new Set(input.ids)].map(toUUID);
    const operation = createWebhookOperation(toWorkspaceID(workspaceID));
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database,
      operation
    });
    const deletedAt = new Date();
    const deleted = await (async () => {
      const rows = await database
        .update(entries)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(
          and(
            inArray(entries.id, entryIDs),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        )
        .returning({ id: entries.id, name: entries.name, collectionID: entries.collectionID });

      if (rows.length > 0) {
        await database
          .update(memberships)
          .set({ currentEntryID: null, updatedAt: new Date() })
          .where(
            and(
              eq(memberships.workspaceID, workspaceID),
              inArray(
                memberships.currentEntryID,
                rows.map(({ id }) => id)
              )
            )
          );
      }

      return rows;
    })();

    await recorder.record(
      deleted.map((entry) => {
        const context = getWebhookEntryContext(recorder.before, entry);

        return {
          event: createOutboundEvent(
            operation,
            "deleted",
            {
              type: "entry.deleted",
              subject: context.subject,
              data: {
                name: entry.name,
                collectionID: context.collectionID,
                deletedAt: deletedAt.toISOString()
              }
            },
            deletedAt
          ),
          resources: [{ ...context.subject, before: context.scope, after: null }]
        };
      })
    );

    return { entryIDs: deleted.map(({ id }) => toEntryID(id)) };
  }
);

export { deleteEntries };
