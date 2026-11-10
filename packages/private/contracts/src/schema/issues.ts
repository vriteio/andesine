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
export { CONTENT_SCHEMA_ISSUE_CODES };
export type { ContentSchemaIssue, ContentSchemaIssueCode, ContentSchemaValidation };
