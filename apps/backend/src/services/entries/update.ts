import { entries } from "@andesine/server/database";
import { assertContentNameAvailable } from "@andesine/server/content";
import {
  createOutboundEvent,
  createWebhookOperation,
  createWebhookRecorder,
  getWebhookEntryContext,
  type WebhookOperation
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import { assertExpectedValue } from "#backend/lib/content";
import { toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import { type VersionDetails } from "@andesine/contracts/versions";
import { and, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { normalizeEntryName } from "@andesine/contracts/content";
import { withAuthorization } from "#backend/lib/policy";
import { bulkUpdateEntries, type BulkUpdateItem } from "./bulk-update";

interface UpdateEntryInput extends BulkUpdateItem {
  contributorIDs: string[];
}
interface ResolvedUpdateEntry {
  entry: { id: string; name: string; collectionID: string | null };
}
interface UpdateEntryResult {
  createdVersions: VersionDetails[];
  hash?: string;
  version?: VersionDetails;
  webhookOperation?: WebhookOperation;
}

const renameEntry = withAuthorization<UpdateEntryInput, ResolvedUpdateEntry, UpdateEntryResult>(
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
    const expectedName =
      input.expectedName === undefined ? undefined : normalizeEntryName(input.expectedName);

    assertExpectedValue("name", expectedName, resolved.entry.name);

    if (input.name === undefined) return { createdVersions: [] };

    const name = normalizeEntryName(input.name);

    if (name === resolved.entry.name) return { createdVersions: [] };

    const operation = createWebhookOperation(toWorkspaceID(workspaceID));
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database,
      operation
    });
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

    return { createdVersions: [], webhookOperation: operation };
  }
);

/**
 * Renames the entry, or writes its content as `entries.bulkUpdate` does for one item: a diff
 * when the current hash matches `expectedHash`, after saving unsaved replaced content.
 */
const updateEntry = withAuthorization<UpdateEntryInput, undefined, UpdateEntryResult>(
  {},
  async ({ auth, input }) => {
    const { contributorIDs, ...item } = input;
    const writesContent = [item.document, item.mdx, item.operations].some(
      (value) => value !== undefined
    );

    if (!writesContent) return renameEntry({ ...input, auth });

    const result = await bulkUpdateEntries({ auth, items: [item], contributorIDs });
    const [updated] = result.items;

    // One item has no other entries that could keep a change, so this is never set.
    if (result.error) throw result.error;

    return {
      createdVersions: result.createdVersions,
      hash: updated.hash,
      version: updated.version
    };
  }
);

export { updateEntry };
