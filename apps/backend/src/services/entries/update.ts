import { assertContentNameAvailable } from "#backend/lib/content/names";
import { toUUID } from "#backend/lib/primitives";
import { entries, type Entry } from "#backend/db";
import { and, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { normalizeEntryName } from "#backend/lib/validation";
import { withAuthorization } from "#backend/lib/policy";
import { toWorkspaceID } from "#backend/lib/primitives/id";
import { createOutboundEvent, createWebhookOperation } from "#backend/lib/webhooks/operation";
import { createWebhookRecorder } from "#backend/lib/webhooks/recorder";
import { getWebhookEntryContext } from "#backend/lib/webhooks/entry-context";

interface UpdateEntryInput extends Partial<Pick<Entry, "name">> {
  id: string;
}
interface ResolvedUpdateEntry {
  entry: { id: string; name: string; collectionID: string | null };
}
interface UpdateEntryResult {
  webhookOperationID?: string;
}

const updateEntry = withAuthorization<UpdateEntryInput, ResolvedUpdateEntry, UpdateEntryResult>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "entry:update", collectionID: resolved.entry.collectionID }]
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const [entry] = await database
        .select({ id: entries.id, name: entries.name, collectionID: entries.collectionID })
        .from(entries)
        .where(
          and(
            eq(entries.id, toUUID(input.id)),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        )
        .for("update");

      if (!entry) throw new ORPCError("NOT_FOUND");

      return { entry };
    },
    transaction: "locked-workspace"
  },
  async ({ database, input, resolved, workspaceID }) => {
    if (input.name === undefined) return {};

    const name = normalizeEntryName(input.name);

    if (name === resolved.entry.name) return {};

    const operation = createWebhookOperation(toWorkspaceID(workspaceID));
    const recorder = await createWebhookRecorder({ database, operation });
    const context = getWebhookEntryContext(recorder.before, resolved.entry);

    await assertContentNameAvailable(database, workspaceID, {
      kind: "entry",
      id: toUUID(input.id),
      parentID: resolved.entry.collectionID,
      name
    });

    const [updated] = await database
      .update(entries)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(entries.id, toUUID(input.id)),
          eq(entries.workspaceID, workspaceID),
          isNull(entries.deletedAt)
        )
      )
      .returning({ id: entries.id });

    if (!updated) throw new ORPCError("NOT_FOUND");

    await recorder.record([
      {
        event: createOutboundEvent(operation, "updated", {
          type: "entry.updated",
          subject: context.subject,
          data: { collectionID: context.collectionID, changedFields: ["name"] }
        }),
        resources: [{ ...context.subject, before: context.scope, after: context.scope }]
      }
    ]);

    return { webhookOperationID: operation.id };
  }
);

export { updateEntry };
