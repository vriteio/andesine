import * as z from "zod";

/** One combined schema as JSON Schema, e.g. `{ type: "object", properties: { title: … } }`. */
interface JSONSchemaObject {
  type: "object";
  properties: Record<string, object>;
  required?: string[];
}
/** A schema library's schema with the Standard JSON Schema interface, e.g. a Zod object. */
interface StandardJSONSchema {
  "~standard": { jsonSchema: { input(options: { target: "draft-2020-12" }): unknown } };
}

type SchemaFieldsInput<T> = T | JSONSchemaObject | StandardJSONSchema;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
/**
 * The fields of a combined schema, in the order of its properties; with `withRequired`, the ones
 * that it requires are marked. Arrays and other values are left for validation.
 */
const toSchemaFields = (input: unknown, withRequired: boolean): unknown => {
  const standard =
    isRecord(input) && isRecord(input["~standard"])
      ? (input["~standard"] as Partial<StandardJSONSchema["~standard"]>)
      : null;
  const schema = standard?.jsonSchema
    ? standard.jsonSchema.input({ target: "draft-2020-12" })
    : input;

  if (!isRecord(schema) || !isRecord(schema.properties)) return schema;

  const required = withRequired && Array.isArray(schema.required) ? schema.required : [];

  return Object.entries(schema.properties).map(([name, field]) => ({
    name,
    ...(field as object),
    ...(required.includes(name) && { required: true })
  }));
};
/**
 * Ordered fields: an array of them, or a combined schema that becomes the array, in the order of
 * its properties. Only the array is stored, so its order holds, e.g. in a `jsonb` column.
 */
const createSchemaFieldsType = <T extends z.ZodType>(
  fieldsType: T,
  options: { withRequired: boolean }
) => {
  const type = z.preprocess((input) => toSchemaFields(input, options.withRequired), fieldsType);

  return type as unknown as z.ZodType<z.output<T>, SchemaFieldsInput<z.input<T>>>;
};

export { createSchemaFieldsType };
export type { JSONSchemaObject, SchemaFieldsInput, StandardJSONSchema };
