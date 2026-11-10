import { getSchemaRevision } from "./get-revision";
import { createCollectionSchema } from "./create";
import { deleteCollectionSchema } from "./delete";
import { getCollectionSchema } from "./get";
import { Migrations } from "./migrations";
import { updateSchemaDraft } from "./update-draft";
import { Versions } from "./versions";

const Schema = {
  create: createCollectionSchema,
  delete: deleteCollectionSchema,
  get: getCollectionSchema,
  getRevision: getSchemaRevision,
  updateDraft: updateSchemaDraft,
  Migrations,
  Versions
};

export { Schema };
