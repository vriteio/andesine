import { instanceContract } from "./instance";
import { assetConfigSchema } from "#backend/lib/assets/config-schema";
import { createAssetsContract } from "./assets";
import { authContract } from "./auth";
import { billingContract } from "./billing";
import { collectionsContract } from "./collections";
import { contentContract } from "./content";
import { entriesContract } from "./entries";
import { groupsContract } from "./groups";
import { keysContract } from "./keys";
import { membershipsContract } from "./memberships";
import { publishingContract } from "./publishing";
import { rolesContract } from "./roles";
import { schemaMigrationsContract } from "./schema-migrations";
import { schemaVersionsContract } from "./schema-versions";
import { schemasContract } from "./schemas";
import { searchContract } from "./search";
import { syncContract } from "./sync";
import { versionsContract } from "./versions";
import { typeMetadataContract } from "./type-metadata";
import { workspacesContract } from "./workspaces";

interface APIContractOptions {
  maxUploadBytes?: number;
}

const createAPIContract = (options: APIContractOptions = {}) => ({
  assets: createAssetsContract(
    options.maxUploadBytes ?? assetConfigSchema.shape.ASSET_MAX_UPLOAD_BYTES.parse(undefined)
  ),
  auth: authContract,
  instance: instanceContract,
  entries: entriesContract,
  groups: groupsContract,
  collections: collectionsContract,
  content: contentContract,
  billing: billingContract,
  keys: keysContract,
  roles: rolesContract,
  search: searchContract,
  schemas: schemasContract,
  schemaMigrations: schemaMigrationsContract,
  schemaVersions: schemaVersionsContract,
  memberships: membershipsContract,
  publishing: publishingContract,
  workspaces: workspacesContract,
  versions: versionsContract,
  typeMetadata: typeMetadataContract,
  sync: syncContract
});

type APIContract = ReturnType<typeof createAPIContract>;

export { createAPIContract };
export type { APIContract, APIContractOptions };
