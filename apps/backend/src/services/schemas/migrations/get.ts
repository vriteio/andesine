import { mapSchemaMigration, type SchemaMigrationDetails } from "#backend/lib/data";
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
