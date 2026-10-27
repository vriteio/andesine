import { ELEMENT_NAME } from "@andesine/document";
import * as z from "zod";
import { uniqueItems } from "../primitives/unique";
import { createSchemaFieldsType } from "./schema-fields";

type ExtensionElementPropFields = z.output<typeof extensionElementPropFieldsType>;
type ExtensionElementPropField = ExtensionElementPropFields[number];

const MAX_ELEMENT_PROP_FIELDS = 20;
const propKeyType = z.string().max(100).regex(ELEMENT_NAME, "Use a prop name, e.g. title");
const metadata = {
  name: propKeyType,
  title: z.string().min(1).max(60).optional(),
  description: z.string().min(1).max(200).optional()
};
const ENUM_CONTROLS = new Set(["select", "toggle"]);
// One string shape with an optional `enum`: two `type: "string"` shapes make input coercion
// ambiguous, which rejects valid fields.
const stringFieldType = z
  .strictObject({
    ...metadata,
    type: z.literal("string"),
    /** Options: a select (default) or, for a few options, a toggle group. */
    enum: z.array(z.string().min(1).max(100)).min(1).max(20).refine(uniqueItems).optional(),
    /**
     * Without `enum`: an input (default), a multi-line input, an icon picker, or a link: an entry,
     * URL, or path.
     */
    control: z.enum(["input", "textarea", "icon", "link", "select", "toggle"]).optional(),
    placeholder: z.string().min(1).max(100).optional(),
    minLength: z.int().min(0).max(10_000).optional(),
    maxLength: z.int().min(1).max(10_000).optional(),
    default: z.string().optional()
  })
  .refine((field) => !field.control || ENUM_CONTROLS.has(field.control) === Boolean(field.enum), {
    message: "Use select or toggle with enum, and input, textarea, icon, or link without it",
    path: ["control"]
  });
const propFieldType = z.discriminatedUnion("type", [
  stringFieldType,
  z.strictObject({
    ...metadata,
    type: z.enum(["number", "integer"]),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    default: z.number().optional()
  }),
  z.strictObject({ ...metadata, type: z.literal("boolean"), default: z.boolean().optional() })
]);
/** Whether a value fits a field; the editor applies the same rules. */
const isElementPropValue = (field: ExtensionElementPropField, value: unknown): boolean => {
  if (field.type === "boolean") return typeof value === "boolean";

  if (field.type === "number" || field.type === "integer") {
    const isNumber = typeof value === "number" && Number.isFinite(value);
    const isInRange =
      isNumber &&
      (field.minimum === undefined || value >= field.minimum) &&
      (field.maximum === undefined || value <= field.maximum);

    return isInRange && (field.type === "number" || Number.isInteger(value));
  }

  if (typeof value !== "string" || field.type !== "string") return false;
  if (field.enum) return field.enum.includes(value);

  return value.length >= (field.minLength ?? 0) && value.length <= (field.maxLength ?? Infinity);
};
/**
 * The props that the editor's props menu edits, in order, each a flat JSON Schema subset with its
 * `name`, like configuration, as stored. Props are optional: one that an element needs takes a
 * `default`, which clearing restores.
 */
const extensionElementPropFieldsType = z
  .array(propFieldType)
  .max(MAX_ELEMENT_PROP_FIELDS, `Use at most ${MAX_ELEMENT_PROP_FIELDS} props`)
  .refine((fields) => uniqueItems(fields.map(({ name }) => name)), "Props must be unique")
  .superRefine((fields, context) => {
    for (const [index, field] of fields.entries()) {
      if (field.default !== undefined && !isElementPropValue(field, field.default)) {
        context.addIssue({
          code: "custom",
          path: [index, "default"],
          message: "The default does not match the prop"
        });
      }
    }
  });
/** The manifest's props schema: the fields, or one combined schema that becomes them. */
const extensionElementPropsType = createSchemaFieldsType(extensionElementPropFieldsType, {
  withRequired: false
});

/** The props of a new element: its props' defaults. */
const getElementPropDefaults = (
  fields: ExtensionElementPropFields = []
): Record<string, ExtensionElementPropField["default"]> => {
  return Object.fromEntries(
    fields.flatMap((field) => (field.default === undefined ? [] : [[field.name, field.default]]))
  );
};

export {
  extensionElementPropFieldsType,
  extensionElementPropsType,
  getElementPropDefaults,
  isElementPropValue
};
export type { ExtensionElementPropFields, ExtensionElementPropField };
