import { listContentLossEntries } from "./list-content-loss-entries";
import { applySchema } from "./apply";
import { getActiveSchemaMigration } from "./get-active";
import { getSchemaMigration } from "./get";

const Migrations = {
  apply: applySchema,
  listContentLossEntries,
  getActive: getActiveSchemaMigration,
  get: getSchemaMigration
};

export { Migrations };
