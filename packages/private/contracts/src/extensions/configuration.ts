import * as z from "zod";
import { uniqueItems } from "../primitives/unique";
import { createSchemaFieldsType } from "./schema-fields";

type ExtensionConfiguration = z.output<typeof extensionConfigurationFieldsType>;
type ExtensionConfigurationField = ExtensionConfiguration[number];
type ExtensionConfigurationItem = z.output<typeof itemType>;
type ExtensionConfigurationPrimitive = string | number | boolean;
type ExtensionConfigurationValue =
  ExtensionConfigurationPrimitive | ExtensionConfigurationPrimitive[];

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
  name: fieldKeyType,
  title: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  /** Missing required values are a state that the extension's settings show, not an error. */
  required: z.boolean().optional()
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
/**
 * Settings fields in order, each a flat JSON Schema subset with its `name`, as stored; the host
 * validates them without running extension code.
 */
const extensionConfigurationFieldsType = z
  .array(fieldType)
  .max(MAX_CONFIGURATION_FIELDS, `Use at most ${MAX_CONFIGURATION_FIELDS} fields`)
  .refine((fields) => uniqueItems(fields.map(({ name }) => name)), "Fields must be unique")
  .superRefine((fields, context) => {
    for (const [index, field] of fields.entries()) {
      const isSecretWithDefault = "secret" in field && field.secret && field.default !== undefined;

      if (isSecretWithDefault) {
        context.addIssue({
          code: "custom",
          path: [index, "default"],
          message: "Secret fields cannot have defaults"
        });
      } else if (field.default !== undefined) {
        const result = createConfigurationValueType(field).safeParse(field.default);

        if (!result.success) {
          context.addIssue({
            code: "custom",
            path: [index, "default"],
            message: "The default does not match the field"
          });
        }
      }
    }
  });
/** The manifest's settings: the fields, or one combined schema that becomes them. */
const extensionConfigurationType = createSchemaFieldsType(extensionConfigurationFieldsType, {
  withRequired: true
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
    configuration.map((field) => [field.name, createConfigurationValueType(field).optional()])
  );

  return z.strictObject(shape) as z.ZodType<Record<string, ExtensionConfigurationValue>>;
};
export {
  MAX_CONFIGURATION_FIELDS,
  extensionConfigurationFieldsType,
  extensionConfigurationType,
  createConfigurationValueType,
  createConfigurationValuesType
};
export type { ExtensionConfiguration, ExtensionConfigurationField, ExtensionConfigurationValue };
