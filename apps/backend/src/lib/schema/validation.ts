import { findDisallowedElementBlock } from "@andesine/editor/element";
import { getContentFieldKey } from "#backend/lib/content/blocks";
import type { ContentNode } from "#backend/lib/content/document";
import { normalizePropertyDate } from "#backend/lib/content/properties";
import { contentNodeType } from "#backend/lib/content/validation";
import {
  SCHEMA_FIELD_ID_ATTRIBUTE,
  schemaDefinitionType,
  type SchemaDefinition,
  type SchemaProperty
} from "./contract/definition";

interface ContentSchemaIssue {
  code: ContentSchemaIssueCode;
  message: string;
  path: Array<string | number>;
  fieldID?: string;
}
interface ContentSchemaValidation {
  valid: boolean;
  issues: ContentSchemaIssue[];
}

type ContentSchemaIssueCode = (typeof CONTENT_SCHEMA_ISSUE_CODES)[number];

const CONTENT_SCHEMA_ISSUE_CODES = [
  "invalid_schema",
  "invalid_structure",
  "missing_field",
  "unknown_field",
  "duplicate_field",
  "field_kind_mismatch",
  "field_key_mismatch",
  "property_type_mismatch",
  "invalid_property_value",
  "invalid_field_options",
  "invalid_allowed_blocks",
  "invalid_fragment_content"
] as const;

const hasSameOptions = (value: unknown, expected: string[]): boolean => {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && expected.includes(item)) &&
    expected.every((item) => value.includes(item))
  );
};
const isValidPropertyValue = (property: SchemaProperty, value: unknown): boolean => {
  if (property.type === "checkbox") return typeof value === "boolean";

  if (property.type === "multi-select") {
    return (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string" && property.options.includes(item))
    );
  }

  if (property.type === "number") {
    return (
      (typeof value === "string" || typeof value === "number") &&
      (value === "" || Number.isFinite(Number(value)))
    );
  }

  if (typeof value !== "string") return false;
  if (value === "") return true;
  if (property.type === "select") return property.options.includes(value);
  if (property.type === "date") return normalizePropertyDate(value) !== undefined;

  return true;
};
// Validate against the recorded definition. Never run migration or apply defaults here.
const validateContentSchema = (
  document: ContentNode,
  schema: SchemaDefinition
): ContentSchemaValidation => {
  const issues: ContentSchemaIssue[] = [];
  const parsedSchema = schemaDefinitionType.safeParse(schema);
  const parsedDocument = contentNodeType.safeParse(document);
  const seenFieldIDs = new Set<string>();

  if (!parsedSchema.success) {
    issues.push(
      ...parsedSchema.error.issues.map((issue): ContentSchemaIssue => ({
        code: "invalid_schema",
        message: issue.message,
        path: [
          "schema",
          ...issue.path.map((part) => (typeof part === "number" ? part : String(part)))
        ]
      }))
    );
  }

  if (!parsedDocument.success) {
    issues.push(
      ...parsedDocument.error.issues.map((issue): ContentSchemaIssue => ({
        code: "invalid_structure",
        message: issue.message,
        path: issue.path.map((part) => (typeof part === "number" ? part : String(part)))
      }))
    );
  }

  if (!parsedSchema.success || !parsedDocument.success) return { valid: false, issues };

  const fieldsByID = new Map(schema.fields.map((field) => [field.id, field]));

  if (document.type !== "doc") {
    issues.push({
      code: "invalid_structure",
      message: "Content must be a document",
      path: ["type"]
    });
  }

  (document.content || []).forEach((node, index) => {
    const path: Array<string | number> = ["content", index];
    const kind = node.type;
    const fieldID = node.attrs?.[SCHEMA_FIELD_ID_ATTRIBUTE];
    const field = typeof fieldID === "string" ? fieldsByID.get(fieldID) : undefined;
    const addIssue = (code: ContentSchemaIssueCode, message: string, attribute?: string) => {
      issues.push({
        code,
        message,
        path: attribute ? [...path, "attrs", attribute] : path,
        ...(typeof fieldID === "string" && { fieldID })
      });
    };

    if (kind === "title" && index === 0) return;

    if (kind !== "fragment" && kind !== "property") {
      addIssue("invalid_structure", "Schema content must be inside its declared fields");
      return;
    }

    if (!field) {
      addIssue(
        "unknown_field",
        "Field does not belong to the recorded schema",
        SCHEMA_FIELD_ID_ATTRIBUTE
      );
      return;
    }

    if (seenFieldIDs.has(field.id)) {
      addIssue("duplicate_field", "Schema field occurs more than once", SCHEMA_FIELD_ID_ATTRIBUTE);
    }

    seenFieldIDs.add(field.id);

    if (kind !== field.kind) {
      addIssue("field_kind_mismatch", `Schema field must be a ${field.kind}`);
      return;
    }

    const labelAttribute = kind === "fragment" ? "name" : "label";
    const key = getContentFieldKey(kind, node.attrs?.[labelAttribute]);
    const expectedKey = getContentFieldKey(field.kind, field.label);

    if (typeof node.attrs?.[labelAttribute] !== "string" || key !== expectedKey) {
      addIssue(
        "field_key_mismatch",
        `Field label must produce the key "${expectedKey}"`,
        labelAttribute
      );
    }

    if (field.kind === "property") {
      if (node.attrs?.type !== field.type) {
        addIssue("property_type_mismatch", `Property must have type "${field.type}"`, "type");
      }

      if (!isValidPropertyValue(field, node.attrs?.value)) {
        addIssue("invalid_property_value", `Value does not match the ${field.type} field`, "value");
      }

      if (!hasSameOptions(node.attrs?.options, field.options)) {
        addIssue(
          "invalid_field_options",
          "Property options do not match the recorded schema",
          "options"
        );
      }

      if (node.content?.length) {
        addIssue("invalid_structure", "Properties cannot contain content blocks");
      }

      return;
    }

    if (!hasSameOptions(node.attrs?.allowedBlocks, field.allowedBlocks)) {
      addIssue(
        "invalid_allowed_blocks",
        "Allowed blocks do not match the recorded schema",
        "allowedBlocks"
      );
    }

    const invalidBlock = findDisallowedElementBlock(node.content || [], field.allowedBlocks);

    if (invalidBlock) {
      addIssue("invalid_fragment_content", `Fragment does not allow ${invalidBlock} blocks`);
    }
  });

  for (const field of schema.fields) {
    if (!seenFieldIDs.has(field.id)) {
      issues.push({
        code: "missing_field",
        message: `Required ${field.kind} field is missing`,
        path: ["content"],
        fieldID: field.id
      });
    }
  }

  return { valid: issues.length === 0, issues };
};

export { CONTENT_SCHEMA_ISSUE_CODES, validateContentSchema };
export type { ContentSchemaIssue, ContentSchemaIssueCode, ContentSchemaValidation };
