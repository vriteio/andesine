import { assertSchemaDraftDocument, updateSchemaDraftDocument } from "#backend/collaboration";
import { assertExpectedValue } from "#backend/lib/content";
import { getUserAuthorization, withAuthorization } from "#backend/lib/policy";
import { type LocalCollectionSchema, type SchemaDefinition } from "@andesine/contracts/schema";
import { toCollectionID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { getCollectionSchema } from "./get";
import { resolveEnabledSchema, type ResolvedEnabledSchema } from "./resolve";

interface UpdateSchemaDraftInput {
  definition: SchemaDefinition;
  expectedHash?: string;
  schemaID: string;
}

const updateSchemaDraft = withAuthorization<
  UpdateSchemaDraftInput,
  ResolvedEnabledSchema,
  LocalCollectionSchema
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:update", collectionID: resolved.collectionID }]
    }),
    resolve: resolveEnabledSchema
  },
  async ({ auth, input, resolved, workspaceID }) => {
    assertSchemaDraftDocument(input.definition);

    const hash = await updateSchemaDraftDocument(input.schemaID, workspaceID, input.definition, {
      contributorID: getUserAuthorization(auth)?.memberID,
      expectedHash: input.expectedHash
    });

    assertExpectedValue("draft hash", input.expectedHash, hash);

    const { local } = await getCollectionSchema({
      auth,
      collectionID: toCollectionID(resolved.collectionID)
    });

    if (!local) throw new ORPCError("NOT_FOUND", { message: "Schema not found" });

    return local;
  }
);

export { updateSchemaDraft };
