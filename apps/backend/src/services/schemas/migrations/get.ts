import { mapSchemaMigration } from "#backend/lib/data";
import { type SchemaMigrationDetails } from "@andesine/contracts/schema";
import { withAuthorization } from "#backend/lib/policy";
import {
  resolveSchemaMigration,
  type GetSchemaMigrationInput,
  type ResolvedSchemaMigration
} from "#backend/lib/schema/migration/resolve";

const getSchemaMigration = withAuthorization<
  GetSchemaMigrationInput,
  ResolvedSchemaMigration,
  SchemaMigrationDetails
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:read", collectionID: resolved.collectionID }]
    }),
    resolve: resolveSchemaMigration
  },
  async ({ resolved }) => mapSchemaMigration(resolved.migration)
);

export { getSchemaMigration };
