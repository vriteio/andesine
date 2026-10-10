import {
  createConfigurationValueType,
  type ExtensionConfiguration,
  type ExtensionConfigurationField,
  type ExtensionConfigurationValue
} from "@andesine/contracts/extensions";
import {
  extensionConfigurations,
  extensionSecrets,
  type DatabaseClient
} from "@andesine/server/database";
import { eq } from "drizzle-orm";

type ConfigurationValues = Record<string, ExtensionConfigurationValue>;

const isSecretField = (field: ExtensionConfigurationField): boolean => {
  return "secret" in field && field.secret === true;
};
const getSecretKeys = (schema: ExtensionConfiguration | undefined): string[] => {
  return Object.entries(schema?.properties ?? {})
    .filter(([, field]) => isSecretField(field))
    .map(([key]) => key);
};
/** Non-secret values: stored values that still match their field, otherwise the defaults. */
const resolveConfigurationValues = (
  schema: ExtensionConfiguration | undefined,
  stored: Record<string, unknown>
): ConfigurationValues => {
  const values: ConfigurationValues = {};

  for (const [key, field] of Object.entries(schema?.properties ?? {})) {
    if (isSecretField(field)) continue;

    const result = createConfigurationValueType(field).safeParse(stored[key]);

    if (result.success) {
      values[key] = result.data;
    } else if (field.default !== undefined) {
      values[key] = field.default;
    }
  }

  return values;
};
/** Required fields without a value: non-secret fields without a default, or unset secrets. */
const getMissingConfiguration = async (
  database: DatabaseClient,
  extensionID: string,
  schema: ExtensionConfiguration | undefined
): Promise<string[]> => {
  const required = schema?.required ?? [];

  if (!schema || !required.length) return [];

  const [stored] = await database
    .select({ values: extensionConfigurations.values })
    .from(extensionConfigurations)
    .where(eq(extensionConfigurations.extensionID, extensionID));
  const secrets = await database
    .select({ key: extensionSecrets.key })
    .from(extensionSecrets)
    .where(eq(extensionSecrets.extensionID, extensionID));
  const values = resolveConfigurationValues(schema, stored?.values ?? {});

  return required.filter((key) => {
    return isSecretField(schema.properties[key])
      ? !secrets.some((secret) => secret.key === key)
      : values[key] === undefined;
  });
};

export { isSecretField, getSecretKeys, resolveConfigurationValues, getMissingConfiguration };
