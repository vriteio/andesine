import {
  createConfigurationValueType,
  createConfigurationValuesType,
  type ExtensionConfiguration
} from "@andesine/contracts/extensions";
import { isSecretField } from "@andesine/server/extensions";
import {
  extensionConfigurations,
  extensionSecrets,
  type DatabaseClient
} from "@andesine/server/database";
import { createSecretEncryption } from "@andesine/server/security";
import { config } from "#backend/lib/config";
import { ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";

interface ConfigurationInput {
  /** All non-secret values; they replace the stored ones. */
  values: Record<string, unknown>;
  /** Secret fields to set, or null to clear; others are unchanged. */
  secrets?: Record<string, string | null>;
}
interface ConfigurationWrite {
  revision: number;
  /** Keys of the changed fields, including secret fields; never values. */
  changedKeys: string[];
}

const encryption = createSecretEncryption(config.ENCRYPTION_KEYS);

// The context binds each ciphertext to its extension and field.
const getSecretContext = (extensionID: string, key: string): string => {
  return `extension-configuration:${extensionID}:${key}`;
};
/** `extensionID` is the extension's UUID. */
const encryptSecret = (extensionID: string, key: string, value: string): Buffer => {
  return encryption.encrypt(Buffer.from(value, "utf8"), getSecretContext(extensionID, key));
};
/** `extensionID` is the extension's UUID. */
const decryptSecret = (extensionID: string, key: string, ciphertext: Uint8Array): string => {
  return encryption.decrypt(ciphertext, getSecretContext(extensionID, key)).toString("utf8");
};
/** The stored secret, or undefined when it cannot be decrypted (for example after key rotation). */
const readStoredSecret = (
  extensionID: string,
  key: string,
  ciphertext: Uint8Array
): string | undefined => {
  try {
    return decryptSecret(extensionID, key, ciphertext);
  } catch {
    return undefined;
  }
};
/** Field keys of the invalid values; error messages never contain values. */
const getInvalidFields = (
  schema: ExtensionConfiguration | undefined,
  input: ConfigurationInput
): string[] => {
  const fields = Object.entries(schema?.properties ?? {});
  const secretFields = new Map(fields.filter(([, field]) => isSecretField(field)));
  const valuesType = createConfigurationValuesType({
    type: "object",
    properties: Object.fromEntries(fields.filter(([, field]) => !isSecretField(field))),
    additionalProperties: false
  });
  const result = valuesType.safeParse(input.values);
  const invalidValues = (result.error?.issues ?? []).flatMap((issue) => {
    return issue.code === "unrecognized_keys" ? issue.keys : [String(issue.path[0])];
  });
  const invalidSecrets = Object.entries(input.secrets ?? {})
    .filter(([key, value]) => {
      const field = secretFields.get(key);

      if (!field || value === "") return true;

      return value !== null && !createConfigurationValueType(field).safeParse(value).success;
    })
    .map(([key]) => key);

  return [...new Set([...invalidValues, ...invalidSecrets])];
};
/** Validates and writes the input, encrypting secrets. `extensionID` is the extension's UUID. */
const writeConfiguration = async (
  database: DatabaseClient,
  extensionID: string,
  schema: ExtensionConfiguration | undefined,
  input: ConfigurationInput
): Promise<ConfigurationWrite> => {
  const invalidFields = getInvalidFields(schema, input);

  if (invalidFields.length) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Invalid configuration fields: ${invalidFields.join(", ")}`
    });
  }

  const [stored] = await database
    .select({ values: extensionConfigurations.values })
    .from(extensionConfigurations)
    .where(eq(extensionConfigurations.extensionID, extensionID));
  const storedSecrets = await database
    .select({ key: extensionSecrets.key, ciphertext: extensionSecrets.ciphertext })
    .from(extensionSecrets)
    .where(eq(extensionSecrets.extensionID, extensionID));
  const previous = stored?.values ?? {};
  const changedValues = [...new Set([...Object.keys(previous), ...Object.keys(input.values)])];
  const changedSecrets: string[] = [];

  for (const [key, value] of Object.entries(input.secrets ?? {})) {
    const current = storedSecrets.find((secret) => secret.key === key);
    const currentValue = current ? readStoredSecret(extensionID, key, current.ciphertext) : null;
    const isUnchanged = value === currentValue;

    if (isUnchanged) continue;

    changedSecrets.push(key);

    if (value === null) {
      await database
        .delete(extensionSecrets)
        .where(and(eq(extensionSecrets.extensionID, extensionID), eq(extensionSecrets.key, key)));
    } else {
      const ciphertext = encryptSecret(extensionID, key, value);

      await database
        .insert(extensionSecrets)
        .values({ extensionID, key, ciphertext })
        .onConflictDoUpdate({
          target: [extensionSecrets.extensionID, extensionSecrets.key],
          set: { ciphertext, updatedAt: sql`now()` }
        });
    }
  }

  const [written] = await database
    .insert(extensionConfigurations)
    .values({ extensionID, values: input.values })
    .onConflictDoUpdate({
      target: extensionConfigurations.extensionID,
      set: {
        values: input.values,
        revision: sql`${extensionConfigurations.revision} + 1`,
        updatedAt: sql`now()`
      }
    })
    .returning({ revision: extensionConfigurations.revision });

  return {
    revision: written.revision,
    changedKeys: [
      ...changedValues.filter((key) => !isDeepStrictEqual(previous[key], input.values[key])),
      ...changedSecrets
    ]
  };
};

export { encryptSecret, decryptSecret, writeConfiguration };
export type { ConfigurationInput };
