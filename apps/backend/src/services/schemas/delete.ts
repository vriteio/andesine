import { collectionSchemas, schemaVersions } from "@andesine/server/database";
import {
  createEffectiveSchemaChange,
  type EffectiveSchemaChangePlan
} from "@andesine/server/schema";
import {
  getUserAuthorization,
  withAuthorization,
  type AuthorizedServiceInput
} from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { prepareSchemaMigrationConnections } from "#backend/collaboration";
import { submitSchemaMigration } from "#backend/lib/queue";
import { resolveEnabledSchema, type ResolvedEnabledSchema } from "./resolve";

interface DeleteCollectionSchemaInput {
  confirmedDataLoss: boolean;
  schemaID: string;
}
interface DeleteCollectionSchemaResult extends EffectiveSchemaChangePlan {
  collectionID: string;
  schemaID: string;
}

const planCollectionSchemaDeletion = withAuthorization<
  DeleteCollectionSchemaInput,
  ResolvedEnabledSchema,
  DeleteCollectionSchemaResult
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:update", collectionID: resolved.collectionID }]
    }),
    resolve: resolveEnabledSchema,
    transaction: "locked-workspace",
    tree: true
  },
  async ({ auth, authorization, database, input, resolved, workspaceID }) => {
    authorization.assertFullyVisibleSubtree(resolved.collectionID);

    const plan = await createEffectiveSchemaChange({
      database,
      excludedSchemaIDs: [resolved.id],
      initiatedBy: getUserAuthorization(auth)?.memberID
        ? toUUID(getUserAuthorization(auth)!.memberID)
        : null,
      rootCollectionIDs: [resolved.collectionID],
      schemaID: resolved.id,
      schemaVersionID: null,
      workspaceID
    });

    authorization.assertCollectionSources(plan.affectedCollectionIDs, "collection:update");

    if (plan.migrationID && !input.confirmedDataLoss) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Schema migrations require explicit data-loss confirmation",
        data: {
          hints: [
            "Review the affected content first. Set confirmedDataLoss to true only after accepting the possible data loss."
          ]
        }
      });
    }

    // A worker migration disables the schema only after successful activation.
    if (!plan.migrationID) {
      await database
        .update(collectionSchemas)
        .set({ enabled: false, updatedAt: new Date() })
        .where(eq(collectionSchemas.id, resolved.id));
      await database
        .update(schemaVersions)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(schemaVersions.schemaID, resolved.id), eq(schemaVersions.active, true)));
    }

    return {
      ...plan,
      collectionID: resolved.collectionID,
      schemaID: resolved.id
    };
  }
);
const deleteCollectionSchema = async (
  input: DeleteCollectionSchemaInput & AuthorizedServiceInput
): Promise<DeleteCollectionSchemaResult> => {
  const result = await planCollectionSchemaDeletion(input);

  await submitSchemaMigration({
    affectedCollectionIDs: result.affectedCollectionIDs,
    prepareAffectedContent: () => prepareSchemaMigrationConnections(result.affectedCollectionIDs),
    migrationID: result.migrationID,
    totalEntries: result.totalEntries,
    workspaceID: input.auth.workspaceID
  });

  return result;
};

export { deleteCollectionSchema };
export type { DeleteCollectionSchemaInput, DeleteCollectionSchemaResult };
