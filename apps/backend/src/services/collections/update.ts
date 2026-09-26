import { collections } from "@andesine/server/database";
import { createStructureWebhookRecorder } from "@andesine/server/webhooks/recording";
import { assertContentNameAvailable } from "@andesine/server/content";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { type Collection } from "@andesine/contracts/entities";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { normalizeCollectionName, ROOT_COLLECTION_NAME } from "@andesine/contracts/content";
import { withAuthorization } from "#backend/lib/policy";

interface UpdateCollectionInput extends Partial<Pick<Collection, "name">> {
  id: string;
}

const updateCollection = withAuthorization<UpdateCollectionInput>(
  {
    actions: ({ input }) => ({
      collections: [{ action: "collection:update", collectionID: input.id }]
    }),
    transaction: "locked-workspace"
  },
  async ({ database, input, workspaceID }) => {
    if (input.name === undefined) return;

    const name = normalizeCollectionName(input.name);

    if (name === ROOT_COLLECTION_NAME) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Reserved collection name",
        data: {
          hints: [
            "Choose a collection name other than ~, which is reserved for the workspace root."
          ]
        }
      });
    }

    const [collection] = await database
      .select({ parentID: collections.parentID, name: collections.name })
      .from(collections)
      .where(
        and(
          eq(collections.workspaceID, workspaceID),
          eq(collections.id, toUUID(input.id)),
          isNull(collections.deletedAt)
        )
      );

    if (!collection?.parentID) throw new ORPCError("NOT_FOUND");

    if (collection.name === name) return;

    const webhooks = await createStructureWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database,
      workspaceID,
      collectionIDs: [input.id]
    });

    await assertContentNameAvailable(database, workspaceID, {
      kind: "collection",
      id: toUUID(input.id),
      parentID: collection.parentID,
      name
    });

    const updated = await database
      .update(collections)
      .set({ name, updatedAt: new Date() })
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

export { updateCollection };
