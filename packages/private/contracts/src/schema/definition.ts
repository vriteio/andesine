import {
  findDisallowedElementBlock,
  contentNodeType,
  type ContentNode,
  type PropertyType
} from "@andesine/document";
import * as z from "zod";
import { getSchemaFieldKeyConflicts } from "./keys";

interface SchemaProperty {
  id: string;
  kind: "property";
  label: string;
  type: PropertyType;
  initialValue: SchemaPropertyValue;
  options: string[];
  optional?: boolean;
}
interface SchemaFragment {
  id: string;
  kind: "fragment";
  label: string;
  allowedBlocks: SchemaBlockType[];
  initialContent: ContentNode[];
  optional?: boolean;
}
interface SchemaDefinition {
  formatVersion: 1;
  fields: Array<SchemaField>;
}

type SchemaBlockType = (typeof SCHEMA_BLOCK_TYPES)[number];
type SchemaField = SchemaFragment | SchemaProperty;
type SchemaPropertyValue = boolean | string | string[];

const MAX_SCHEMA_FIELD_LABEL_LENGTH = 50;
const SCHEMA_FIELD_ID_ATTRIBUTE = "schemaFieldID";
const SCHEMA_BLOCK_TYPES = [
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "horizontalRule",
  "codeBlock",
  "table",
  "element",
  "image"
] as const;
const schemaBlockType = z.enum(SCHEMA_BLOCK_TYPES);
const schemaPropertyValueType = z.union([z.boolean(), z.string(), z.array(z.string())]);
const schemaPropertyType: z.ZodType<SchemaProperty> = z
  .object({
    id: z.string().min(1),
    kind: z.literal("property"),
    label: z.string().max(MAX_SCHEMA_FIELD_LABEL_LENGTH),
    type: z.enum(["text", "number", "checkbox", "date", "url", "select", "multi-select"]),
    initialValue: schemaPropertyValueType,
    options: z.array(z.string()),
    optional: z.boolean().optional()
  })
  .superRefine((property, context) => {
    const value = property.initialValue;

    if (property.type === "checkbox" && typeof value !== "boolean") {
      context.addIssue({
        code: "custom",
        message: "Checkbox initial values must be boolean",
        path: ["initialValue"]
      });
    }

    if (property.type === "multi-select" && !Array.isArray(value)) {
      context.addIssue({
        code: "custom",
        message: "Multi-select initial values must be string arrays",
        path: ["initialValue"]
      });
    }

    if (
      property.type !== "checkbox" &&
      property.type !== "multi-select" &&
      typeof value !== "string"
    ) {
      context.addIssue({
        code: "custom",
        message: `${property.type} initial values must be strings`,
        path: ["initialValue"]
      });
    }

    if (property.type === "select" && value && !property.options.includes(String(value))) {
      context.addIssue({
        code: "custom",
        message: "Select initial values must match an available option",
        path: ["initialValue"]
      });
    }

    if (
      property.type === "multi-select" &&
      Array.isArray(value) &&
      value.some((item) => !property.options.includes(item))
    ) {
      context.addIssue({
        code: "custom",
        message: "Multi-select initial values must match available options",
        path: ["initialValue"]
      });
    }
  });
const schemaFragmentType: z.ZodType<SchemaFragment> = z
  .object({
    id: z.string().min(1),
    kind: z.literal("fragment"),
    label: z.string().max(MAX_SCHEMA_FIELD_LABEL_LENGTH),
    allowedBlocks: z.array(schemaBlockType),
    initialContent: z.array(contentNodeType).min(1),
    optional: z.boolean().optional()
  })
  .superRefine((fragment, context) => {
    const allowedBlocks = new Set(fragment.allowedBlocks);
    const containsAsset = (node: ContentNode): boolean => {
      return Boolean(
        (node.type === "image" && node.attrs?.assetID) || node.content?.some(containsAsset)
      );
    };

    if (fragment.initialContent.some(containsAsset)) {
      context.addIssue({
        code: "custom",
        message: "Upload images in entries, not initial content",
        path: ["initialContent"]
      });
    }

    fragment.initialContent.forEach((node, index) => {
      if (findDisallowedElementBlock([node], [...allowedBlocks])) {
        context.addIssue({
          code: "custom",
          message: `Initial content uses unsupported block type "${node.type}"`,
          path: ["initialContent", index]
        });
      }
    });
  });
const schemaFieldType: z.ZodType<SchemaField> = z.union([schemaPropertyType, schemaFragmentType]);
const schemaDraftDefinitionType: z.ZodType<SchemaDefinition> = z
  .object({
    formatVersion: z.literal(1),
    fields: z.array(schemaFieldType)
  })
  .superRefine((definition, context) => {
    const fieldIDs = new Set<string>();

    definition.fields.forEach((field, index) => {
      if (fieldIDs.has(field.id)) {
        context.addIssue({
          code: "custom",
          message: `Schema field ID "${field.id}" is duplicated`,
          path: ["fields", index, "id"]
        });
      }

      fieldIDs.add(field.id);
    });
  });
const schemaDefinitionType: z.ZodType<SchemaDefinition> = schemaDraftDefinitionType
  .refine((definition) => definition.fields.length > 0, {
    message: "Schemas must contain at least one property or fragment",
    path: ["fields"]
  })
  .superRefine((definition, context) => {
    for (const conflict of getSchemaFieldKeyConflicts(definition.fields)) {
      definition.fields.forEach((field, index) => {
        if (!conflict.fieldIDs.includes(field.id)) return;

        context.addIssue({
          code: "custom",
          message: `Schema ${conflict.kind} key "${conflict.key}" is duplicated; change the field labels`,
          path: ["fields", index, "label"],
          params: { ...conflict }
        });
      });
    }
  });

const createEmptySchemaDefinition = (): SchemaDefinition => ({ formatVersion: 1, fields: [] });

const getEmptyPropertyValue = (property: Pick<SchemaProperty, "type">): SchemaPropertyValue => {
  if (property.type === "checkbox") return false;
  if (property.type === "multi-select") return [];

  return "";
};

export {
  getEmptyPropertyValue,
  MAX_SCHEMA_FIELD_LABEL_LENGTH,
  SCHEMA_BLOCK_TYPES,
  SCHEMA_FIELD_ID_ATTRIBUTE,
  createEmptySchemaDefinition,
  schemaBlockType,
  schemaDefinitionType,
  schemaDraftDefinitionType,
  schemaFieldType,
  schemaFragmentType,
  schemaPropertyType,
  schemaPropertyValueType
};
export type {
  SchemaBlockType,
  SchemaDefinition,
  SchemaField,
  SchemaFragment,
  SchemaProperty,
  SchemaPropertyValue
};
