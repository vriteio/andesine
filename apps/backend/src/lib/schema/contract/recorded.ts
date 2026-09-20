import { publicID } from "#backend/lib/primitives";
import * as z from "zod";
import { schemaDefinitionType, type SchemaDefinition } from "./definition";

interface ContentSchemaMetadata {
  revisionID: string;
  hash: string;
}
interface SchemaRevision extends ContentSchemaMetadata {
  definition: SchemaDefinition;
}

const schemaHashType = z
  .string()
  .regex(/^[a-f\d]{64}$/)
  .describe("Hash of the effective schema definition");
const contentSchemaMetadataType = z.object({
  revisionID: publicID("schr").describe("Recorded effective schema revision"),
  hash: schemaHashType
});
const schemaRevisionType = contentSchemaMetadataType.extend({
  definition: schemaDefinitionType.describe(
    "Exact effective definition, including inherited fields"
  )
});

export { contentSchemaMetadataType, schemaHashType, schemaRevisionType };
export type { ContentSchemaMetadata, SchemaRevision };
