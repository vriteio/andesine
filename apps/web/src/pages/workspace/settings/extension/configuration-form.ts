import {
  createConfigurationValueType,
  type ExtensionConfiguration,
  type ExtensionConfigurationField,
  type ExtensionConfigurationValue
} from "@andesine/contracts/extensions";

interface ConfigurationDraft {
  /** Form values: text for text and number inputs, booleans for checkboxes, lists for arrays. */
  values: Record<string, DraftValue>;
  /** Secret fields to set (text) or clear (null); absent fields keep their value. */
  secrets: Record<string, string | null>;
}
interface ConfigurationSubmission {
  values: Record<string, ExtensionConfigurationValue>;
  secrets: Record<string, string | null>;
}

type DraftValue = string | boolean | string[];

const isSecretField = (field: ExtensionConfigurationField): boolean => {
  return "secret" in field && field.secret === true;
};
const isNumericField = (field: ExtensionConfigurationField): boolean => {
  return field.type === "number" || field.type === "integer";
};
const getFields = (schema: ExtensionConfiguration | null) => {
  return Object.entries(schema?.properties ?? {});
};
const toDraftValue = (field: ExtensionConfigurationField, value: unknown): DraftValue => {
  if (field.type === "boolean") return value === true;
  if (field.type === "array") return Array.isArray(value) ? value.map(String) : [];

  return value === undefined || value === null ? "" : String(value);
};
/** Undefined for an empty input, so the field is unset (or uses its default). */
const fromDraftValue = (
  field: ExtensionConfigurationField,
  value: DraftValue
): ExtensionConfigurationValue | undefined => {
  if (field.type === "boolean") return value === true;

  if (field.type === "array") {
    const items = value as string[];
    const isNumeric = field.items.type === "number" || field.items.type === "integer";

    if (!items.length) return undefined;

    return isNumeric ? items.map(Number) : items;
  }

  if (value === "") return undefined;

  return isNumericField(field) ? Number(value) : (value as string);
};
const createConfigurationDraft = (
  schema: ExtensionConfiguration | null,
  values: Record<string, unknown>
): ConfigurationDraft => {
  const draftValues = getFields(schema)
    .filter(([, field]) => !isSecretField(field))
    .map(([key, field]) => [key, toDraftValue(field, values[key] ?? field.default)]);

  return { values: Object.fromEntries(draftValues), secrets: {} };
};
/** Required secret fields count as set when `setSecrets` has them. */
const getConfigurationErrors = (
  schema: ExtensionConfiguration | null,
  draft: ConfigurationDraft,
  setSecrets: string[]
): Record<string, string> => {
  const errors: Record<string, string> = {};
  const required = schema?.required ?? [];

  for (const [key, field] of getFields(schema)) {
    const isRequired = required.includes(key);

    if (isSecretField(field)) {
      const secret = draft.secrets[key];
      // An emptied input keeps the stored secret; only "clear" (null) removes it.
      const isUnchanged = secret === undefined || secret === "";
      const isSet = isUnchanged ? setSecrets.includes(key) : secret !== null;
      const result = secret ? createConfigurationValueType(field).safeParse(secret) : null;

      if (isRequired && !isSet) {
        errors[key] = "Required";
      } else if (result && !result.success) {
        errors[key] = result.error.issues[0]?.message || "Invalid value";
      }

      continue;
    }

    const value = fromDraftValue(field, draft.values[key]);

    if (value === undefined) {
      if (isRequired && field.default === undefined) errors[key] = "Required";

      continue;
    }

    const result = createConfigurationValueType(field).safeParse(value);

    if (!result.success) errors[key] = result.error.issues[0]?.message || "Invalid value";
  }

  return errors;
};
/** The values to save; values equal to their default stay unset, so new defaults apply. */
const toConfigurationSubmission = (
  schema: ExtensionConfiguration | null,
  draft: ConfigurationDraft
): ConfigurationSubmission => {
  const values: Record<string, ExtensionConfigurationValue> = {};

  for (const [key, field] of getFields(schema)) {
    if (isSecretField(field)) continue;

    const value = fromDraftValue(field, draft.values[key]);
    const isDefault = JSON.stringify(value) === JSON.stringify(field.default);

    if (value !== undefined && !isDefault) values[key] = value;
  }

  const secrets = Object.entries(draft.secrets).filter(([, secret]) => secret !== "");

  return { values, secrets: Object.fromEntries(secrets) };
};

export {
  isSecretField,
  isNumericField,
  getFields,
  createConfigurationDraft,
  getConfigurationErrors,
  toConfigurationSubmission
};
export type { ConfigurationDraft, DraftValue };
