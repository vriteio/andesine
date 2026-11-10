import { schemaDefinitionType, schemaFieldType, type SchemaField } from "./definition";
import * as z from "zod";

interface SchemaFieldSource {
  collectionID: string;
  inherited: boolean;
  schemaID: string;
  versionID: string;
}
interface ResolvedSchemaProperty extends Extract<SchemaField, { kind: "property" }> {
  source: SchemaFieldSource;
}
interface ResolvedSchemaFragment extends Extract<SchemaField, { kind: "fragment" }> {
  source: SchemaFieldSource;
}
interface ResolvedSchemaDefinition {
  formatVersion: 1;
  fields: Array<ResolvedSchemaField>;
  sourceVersionIDs: string[];
}
type ResolvedSchemaField = ResolvedSchemaFragment | ResolvedSchemaProperty;
const schemaFieldSourceType: z.ZodType<SchemaFieldSource> = z.object({
  collectionID: z.string(),
  inherited: z.boolean(),
  schemaID: z.string(),
  versionID: z.string()
});
const resolvedSchemaFieldType: z.ZodType<ResolvedSchemaField> = z.intersection(
  schemaFieldType,
  z.object({ source: schemaFieldSourceType })
);
const resolvedSchemaDefinitionType: z.ZodType<ResolvedSchemaDefinition> = z
  .object({
    formatVersion: z.literal(1),
    fields: z.array(resolvedSchemaFieldType).min(1),
    sourceVersionIDs: z.array(z.string())
  })
  .superRefine((definition, context) => {
    const result = schemaDefinitionType.safeParse(definition);

    if (!result.success) {
      for (const issue of result.error.issues) context.addIssue({ ...issue });
    }
  });
export { resolvedSchemaDefinitionType, resolvedSchemaFieldType, schemaFieldSourceType };
export type {
  ResolvedSchemaDefinition,
  ResolvedSchemaField,
  ResolvedSchemaFragment,
  ResolvedSchemaProperty,
  SchemaFieldSource
};
