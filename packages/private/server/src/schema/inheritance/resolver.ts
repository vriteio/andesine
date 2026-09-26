import {
  type ResolvedSchemaDefinition,
  type ResolvedSchemaField,
  resolvedSchemaDefinitionType,
  schemaDefinitionType,
  type SchemaDefinition
} from "@andesine/contracts/schema";
import { assertSchemaFieldKeys } from "../errors";

interface SchemaDefinitionSource {
  collectionID: string;
  schemaID: string;
  versionID: string;
  definition: SchemaDefinition;
}

interface ResolveEffectiveSchemaInput {
  collectionID: string;
  sources: SchemaDefinitionSource[];
}

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

export { getResolvedSchemaDefinition, resolveEffectiveSchema };
export type { ResolveEffectiveSchemaInput, SchemaDefinitionSource };
