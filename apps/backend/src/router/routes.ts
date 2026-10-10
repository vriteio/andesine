import { instanceRouter } from "./instance";
import { assetsRouter } from "./assets";
import { authRouter } from "./auth";
import { billingRouter } from "./billing";
import { collectionsRouter } from "./collections";
import { contentRouter } from "./content";
import { entriesRouter } from "./entries";
import { extensionsRouter } from "./extensions";
import { groupsRouter } from "./groups";
import { api } from "./implement";
import { keysRouter } from "./keys";
import { membershipsRouter } from "./memberships";
import { publishingRouter } from "./publishing";
import { rolesRouter } from "./roles";
import { schemaMigrationsRouter } from "./schema-migrations";
import { schemaVersionsRouter } from "./schema-versions";
import { schemasRouter } from "./schemas";
import { searchRouter } from "./search";
import { syncRouter } from "./sync";
import { versionsRouter } from "./versions";
import { typeMetadataRouter } from "./type-metadata";
import { workspacesRouter } from "./workspaces";
import { webhooksRouter } from "./webhooks";

const router = api.router({
  assets: assetsRouter,
  auth: authRouter,
  instance: instanceRouter,
  entries: entriesRouter,
  extensions: extensionsRouter,
  groups: groupsRouter,
  collections: collectionsRouter,
  content: contentRouter,
  billing: billingRouter,
  keys: keysRouter,
  webhooks: webhooksRouter,
  roles: rolesRouter,
  search: searchRouter,
  schemas: schemasRouter,
  schemaMigrations: schemaMigrationsRouter,
  schemaVersions: schemaVersionsRouter,
  memberships: membershipsRouter,
  publishing: publishingRouter,
  workspaces: workspacesRouter,
  versions: versionsRouter,
  typeMetadata: typeMetadataRouter,
  sync: syncRouter
});

export { router };
