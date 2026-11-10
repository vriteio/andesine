import { type ExtensionConfigurationState } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import { extensionConfigurations, extensionSecrets, extensions } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { isVisibleExtension } from "#backend/lib/extensions/installed";
import { withAuthorization } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  getSecretKeys,
  resolveConfigurationValues,
  getExtensionManifest
} from "@andesine/server/extensions";

interface GetConfigurationInput {
  extensionID: string;
}

/** Non-secret values for every member; secret fields only as set, with their update time. */
const getConfiguration = withAuthorization<
  GetConfigurationInput,
  undefined,
  ExtensionConfigurationState
>({ permissions: { session: true } }, async ({ auth, input, workspaceID }) => {
  const [extension] = await db
    .select()
    .from(extensions)
    .where(
      and(
        eq(extensions.id, toUUID(input.extensionID)),
        eq(extensions.workspaceID, workspaceID),
        isNull(extensions.uninstalledAt),
        isVisibleExtension(auth)
      )
    );

  if (!extension) throw new ORPCError("NOT_FOUND", { message: "Extension not found" });

  const schema = (await getExtensionManifest(db, extension))?.configuration;
  const secretKeys = getSecretKeys(schema);
  const [stored] = await db
    .select()
    .from(extensionConfigurations)
    .where(eq(extensionConfigurations.extensionID, extension.id));
  const secrets = await db
    .select({ key: extensionSecrets.key, updatedAt: extensionSecrets.updatedAt })
    .from(extensionSecrets)
    .where(eq(extensionSecrets.extensionID, extension.id));

  return {
    values: resolveConfigurationValues(schema, stored?.values ?? {}),
    secrets: Object.fromEntries(
      secrets
        .filter(({ key }) => secretKeys.includes(key))
        .map(({ key, updatedAt }) => [key, { updatedAt: updatedAt.toISOString() }])
    ),
    revision: stored?.revision ?? 1
  };
});

export { getConfiguration };
