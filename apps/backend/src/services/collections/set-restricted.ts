import { collections } from "@andesine/server/database";
import { createStructureWebhookRecorder } from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { withAuthorization } from "#backend/lib/policy";

interface SetCollectionRestrictedInput {
  id: string;
  restricted: boolean;
}

const setCollectionRestricted = withAuthorization<SetCollectionRestrictedInput>(
  {
    actions: ({ input }) => ({
      collections: [{ action: "collection:set-restricted", collectionID: input.id }]
    }),
    plan: (input) => (input.restricted ? "pro" : undefined),
    transaction: "locked-workspace"
  },
  async ({ database, input, workspaceID }) => {
    const [collection] = await database
      .select({ restricted: collections.restricted })
      .from(collections)
      .where(
        and(
          eq(collections.id, toUUID(input.id)),
          eq(collections.workspaceID, workspaceID),
          isNull(collections.deletedAt),
          sql`${collections.parentID} is not null`
        )
      );

    if (!collection) throw new ORPCError("NOT_FOUND");
    if (collection.restricted === input.restricted) return;

    const webhooks = await createStructureWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database,
      workspaceID,
      collectionIDs: [input.id]
    });
    const updated = await database
      .update(collections)
      .set({ restricted: input.restricted, updatedAt: new Date() })
      .where(
        and(
          eq(collections.id, toUUID(input.id)),
          eq(collections.workspaceID, workspaceID),
          isNull(collections.deletedAt),
          sql`${collections.parentID} is not null`
        )
      )
      .returning({ id: collections.id });

    if (updated.length !== 1) throw new ORPCError("NOT_FOUND");

    await webhooks.record();
  }
);

export { setCollectionRestricted };
