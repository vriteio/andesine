import * as z from "zod";
import { uniqueItems } from "../primitives/unique";

type ExtensionConfiguration = z.output<typeof extensionConfigurationType>;
type ExtensionConfigurationField = ExtensionConfiguration["properties"][string];
type ExtensionConfigurationItem = Exclude<ExtensionConfigurationField, { type: "array" }>;
type ExtensionConfigurationPrimitive = string | number | boolean;
type ExtensionConfigurationValue =
  ExtensionConfigurationPrimitive | ExtensionConfigurationPrimitive[];

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const MAX_CONFIGURATION_FIELDS = 50;
const MAX_CONFIGURATION_STRING_LENGTH = 10_000;
const MAX_CONFIGURATION_ARRAY_ITEMS = 100;
const MAX_CONFIGURATION_ENUM_VALUES = 100;
const MAX_CONFIGURATION_PATTERN_LENGTH = 500;
const isValidPattern = (pattern: string): boolean => {
  try {
    new RegExp(pattern);

    return true;
  } catch {
    return false;
  }
};
const fieldKeyType = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/, "Use a letter, then letters, digits, or underscores");
const lengthType = z.int().min(0).max(MAX_CONFIGURATION_STRING_LENGTH);
const metadata = {
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional()
};
const stringItemType = z.strictObject({
  type: z.literal("string"),
  minLength: lengthType.optional(),
  maxLength: lengthType.optional(),
  pattern: z
    .string()
    .min(1)
    .max(MAX_CONFIGURATION_PATTERN_LENGTH)
    .refine(isValidPattern, "Use a valid regular expression")
    .optional(),
  format: z.enum(["uri", "email"]).optional()
});
const enumItemType = z.strictObject({
  type: z.literal("string"),
  enum: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(MAX_CONFIGURATION_ENUM_VALUES)
    .refine(uniqueItems, "Options must be unique")
});
const numberItemType = z.strictObject({
  type: z.enum(["number", "integer"]),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  exclusiveMinimum: z.number().optional(),
  exclusiveMaximum: z.number().optional(),
  multipleOf: z.number().positive().optional()
});
const booleanItemType = z.strictObject({ type: z.literal("boolean") });
const stringFormatTypes = { uri: z.url(), email: z.email() };
const itemType = z.union([stringItemType, enumItemType, numberItemType, booleanItemType]);
const fieldType = z.union([
  stringItemType.extend({
    ...metadata,
    default: z.string().optional(),
    // Secret values are write-only and readable only by the extension backend.
    secret: z.literal(true).optional(),
    control: z.literal("textarea").optional()
  }),
  enumItemType.extend({ ...metadata, default: z.string().optional() }),
  numberItemType.extend({ ...metadata, default: z.number().optional() }),
  booleanItemType.extend({ ...metadata, default: z.boolean().optional() }),
  z.strictObject({
    ...metadata,
    type: z.literal("array"),
    items: itemType,
    minItems: z.int().min(0).max(MAX_CONFIGURATION_ARRAY_ITEMS).optional(),
    maxItems: z.int().min(0).max(MAX_CONFIGURATION_ARRAY_ITEMS).optional(),
    uniqueItems: z.boolean().optional(),
    default: z.array(z.union([z.string(), z.number(), z.boolean()])).optional()
  })
]);
/** Flat JSON Schema 2020-12 subset; the host validates it without running extension code. */
const extensionConfigurationType = z
  .strictObject({
    $schema: z.literal(JSON_SCHEMA_DIALECT).optional(),
    type: z.literal("object"),
    properties: z
      .record(fieldKeyType, fieldType)
      .refine(
        (properties) => Object.keys(properties).length <= MAX_CONFIGURATION_FIELDS,
        `Use at most ${MAX_CONFIGURATION_FIELDS} fields`
      ),
    required: z.array(fieldKeyType).refine(uniqueItems, "Fields must be unique").optional(),
    additionalProperties: z.literal(false)
  })
  .superRefine((configuration, context) => {
    for (const [index, key] of (configuration.required || []).entries()) {
      if (!configuration.properties[key]) {
        context.addIssue({ code: "custom", path: ["required", index], message: "Unknown field" });
      }
    }

    for (const [key, field] of Object.entries(configuration.properties)) {
      const isSecretWithDefault = "secret" in field && field.secret && field.default !== undefined;

      if (isSecretWithDefault) {
        context.addIssue({
          code: "custom",
          path: ["properties", key, "default"],
          message: "Secret fields cannot have defaults"
        });
      } else if (field.default !== undefined) {
        const result = createConfigurationValueType(field).safeParse(field.default);

        if (!result.success) {
          context.addIssue({
            code: "custom",
            path: ["properties", key, "default"],
            message: "The default does not match the field"
          });
        }
      }
    }
  });
const createConfigurationValueType = (
  field: ExtensionConfigurationField | ExtensionConfigurationItem
): z.ZodType<ExtensionConfigurationValue> => {
  if (field.type === "boolean") return z.boolean();

  if (field.type === "array") {
    const maxItems = Math.min(
      field.maxItems ?? MAX_CONFIGURATION_ARRAY_ITEMS,
      MAX_CONFIGURATION_ARRAY_ITEMS
    );
    const items = z
      .array(
        createConfigurationValueType(field.items) as z.ZodType<ExtensionConfigurationPrimitive>
      )
      .min(field.minItems ?? 0)
      .max(maxItems);

    return field.uniqueItems ? items.refine(uniqueItems, "Values must be unique") : items;
  }

  if ("enum" in field) return z.enum(field.enum as [string, ...string[]]);

  if (field.type === "string") {
    const maxLength = Math.min(
      field.maxLength ?? MAX_CONFIGURATION_STRING_LENGTH,
      MAX_CONFIGURATION_STRING_LENGTH
    );
    const value = (field.format ? stringFormatTypes[field.format] : z.string())
      .min(field.minLength ?? 0)
      .max(maxLength);

    return field.pattern ? value.regex(new RegExp(field.pattern)) : value;
  }

  let value = field.type === "integer" ? z.int() : z.number();

  if (field.minimum !== undefined) value = value.gte(field.minimum);

  if (field.maximum !== undefined) value = value.lte(field.maximum);

  if (field.exclusiveMinimum !== undefined) value = value.gt(field.exclusiveMinimum);

  if (field.exclusiveMaximum !== undefined) value = value.lt(field.exclusiveMaximum);

  if (field.multipleOf !== undefined) value = value.multipleOf(field.multipleOf);

  return value;
};
/** Known fields only; missing required fields are a state, not a validation error. */
const createConfigurationValuesType = (
  configuration: ExtensionConfiguration
): z.ZodType<Record<string, ExtensionConfigurationValue>> => {
  const shape = Object.fromEntries(
    Object.entries(configuration.properties).map(([key, field]) => {
      return [key, createConfigurationValueType(field).optional()];
    })
  );

  return z.strictObject(shape) as z.ZodType<Record<string, ExtensionConfigurationValue>>;
};
/** Converts an authoring Zod object to the configuration subset; unsupported constructs throw. */
const toExtensionConfiguration = (schema: z.ZodObject): ExtensionConfiguration => {
  const jsonSchema = z.toJSONSchema(schema, {
    io: "input",
    target: "draft-2020-12",
    unrepresentable: "throw"
  });
  const result = extensionConfigurationType.safeParse({
    additionalProperties: false,
    ...jsonSchema
  });

  if (!result.success) {
    throw new Error(`Unsupported configuration schema:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
};

export {
  MAX_CONFIGURATION_FIELDS,
  extensionConfigurationType,
  createConfigurationValueType,
  createConfigurationValuesType,
  toExtensionConfiguration
};
export type { ExtensionConfiguration, ExtensionConfigurationField, ExtensionConfigurationValue };
