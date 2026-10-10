import { type ExtensionSelfConfiguration } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import { extensionConfigurations, extensionSecrets, extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  getSecretKeys,
  resolveConfigurationValues,
  getExtensionManifest
} from "@andesine/server/extensions";
import { decryptSecret } from "#backend/lib/extensions/configuration";

/** The extension's configuration with secret values; only for the extension backend. */
const getSelfConfiguration = withAuthorization<
  Record<never, never>,
  undefined,
  ExtensionSelfConfiguration
>({ permissions: { extension: true } }, async ({ auth }) => {
  const [extension] = await db
    .select()
    .from(extensions)
    .where(eq(extensions.id, toUUID(auth.extension!.extensionID)));

  if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  const schema = (await getExtensionManifest(db, extension))?.configuration;
  const secretKeys = getSecretKeys(schema);
  const [stored] = await db
    .select()
    .from(extensionConfigurations)
    .where(eq(extensionConfigurations.extensionID, extension.id));
  const secrets = await db
    .select()
    .from(extensionSecrets)
    .where(eq(extensionSecrets.extensionID, extension.id));
  const values = resolveConfigurationValues(schema, stored?.values ?? {});

  for (const secret of secrets.filter(({ key }) => secretKeys.includes(key))) {
    values[secret.key] = decryptSecret(extension.id, secret.key, secret.ciphertext);
  }

  return { values, revision: stored?.revision ?? 1 };
});

export { getSelfConfiguration };
