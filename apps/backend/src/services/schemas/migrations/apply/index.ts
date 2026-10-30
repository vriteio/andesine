import {
  assertSchemaDraftDocument,
  getCurrentSchemaDefinition,
  prepareSchemaMigrationConnections,
  updateSchemaDraftDocument
} from "#backend/collaboration";
import { hashSchemaDefinition } from "@andesine/server/schema";
import { type SchemaApplicationResult, type SchemaDefinition } from "@andesine/contracts/schema";
import { assertExpectedValue } from "#backend/lib/content";
import { getUserAuthorization, type AuthorizedServiceInput } from "#backend/lib/policy";
import { submitSchemaMigration } from "#backend/lib/queue";
import { ORPCError } from "@orpc/server";
import { createSchemaApplicationPlan } from "./plan";

interface ApplySchemaInput extends AuthorizedServiceInput {
  confirmedDataLoss: boolean;
  definition?: SchemaDefinition;
  expectedHash?: string;
  name?: string;
  schemaID: string;
}

const applySchema = async (input: ApplySchemaInput): Promise<SchemaApplicationResult> => {
  if (!input.confirmedDataLoss) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Schema migrations require explicit data-loss confirmation",
      data: {
        hints: [
          "Review the affected content first. Set confirmedDataLoss to true only after accepting the possible data loss."
        ]
      }
    });
  }

  // Read and persist the collaboration draft before the migration transaction locks the schema.
  // Closing a direct collaboration connection can store the document in a separate transaction.
  const draft = await getCurrentSchemaDefinition(input.schemaID, input.auth.workspaceID);
  const draftHash = hashSchemaDefinition(draft);

  assertExpectedValue("draft hash", input.expectedHash, draftHash);

  if (input.definition) assertSchemaDraftDocument(input.definition);

  const plan = await createSchemaApplicationPlan({
    auth: input.auth,
    name: input.name,
    schemaID: input.schemaID,
    definition: input.definition ?? draft
  });

  // Only after the apply, so a failed one leaves the draft as it was. Edits made meanwhile stay.
  if (input.definition) {
    await updateSchemaDraftDocument(input.schemaID, input.auth.workspaceID, input.definition, {
      contributorID: getUserAuthorization(input.auth)?.memberID,
      expectedHash: draftHash
    });
  }

  await submitSchemaMigration({
    affectedCollectionIDs: plan.affectedCollectionIDs,
    prepareAffectedContent: () => prepareSchemaMigrationConnections(plan.affectedCollectionIDs),
    migrationID: plan.migrationID,
    totalEntries: plan.totalEntries,
    workspaceID: input.auth.workspaceID
  });

  return plan;
};

export { applySchema };
