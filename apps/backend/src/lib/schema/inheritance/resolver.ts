import { assertSchemaFieldKeys } from "../errors";
import {
  schemaDefinitionType,
  schemaFieldType,
  type SchemaDefinition,
  type SchemaField
} from "../contract";
import * as z from "zod";

interface SchemaDefinitionSource {
  collectionID: string;
  schemaID: string;
  versionID: string;
  definition: SchemaDefinition;
}
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
interface ResolveEffectiveSchemaInput {
  collectionID: string;
  sources: SchemaDefinitionSource[];
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

const resolveEffectiveSchema = (
  input: ResolveEffectiveSchemaInput
): ResolvedSchemaDefinition | null => {
  if (input.sources.length === 0) return null;

  const fields: Array<ResolvedSchemaField> = [];

  assertSchemaFieldKeys(input.sources.flatMap(({ definition }) => definition.fields));

  for (const source of input.sources) {
    const definition = schemaDefinitionType.parse(source.definition);

    for (const field of definition.fields) {
      fields.push({
        ...field,
        source: {
          collectionID: source.collectionID,
          inherited: source.collectionID !== input.collectionID,
          schemaID: source.schemaID,
          versionID: source.versionID
        }
      });
    }
  }

  return resolvedSchemaDefinitionType.parse({
    formatVersion: 1,
    fields,
    sourceVersionIDs: input.sources.map(({ versionID }) => versionID)
  });
};
const getResolvedSchemaDefinition = (resolved: ResolvedSchemaDefinition): SchemaDefinition => ({
  formatVersion: 1,
  fields: resolved.fields.map(({ source: _source, ...field }) => field)
});

export {
  getResolvedSchemaDefinition,
  resolveEffectiveSchema,
  resolvedSchemaDefinitionType,
  resolvedSchemaFieldType,
  schemaFieldSourceType
};
export type {
  ResolvedSchemaDefinition,
  ResolvedSchemaField,
  ResolvedSchemaFragment,
  ResolvedSchemaProperty,
  ResolveEffectiveSchemaInput,
  SchemaDefinitionSource,
  SchemaFieldSource
};
