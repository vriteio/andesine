import { extensionRegistryKeys } from "@andesine/server/database";
import { db } from "#backend/lib/adapters";
import { config } from "#backend/lib/config";
import {
  decodeExtensionToken,
  unauthorized,
  verifyExtensionToken
} from "#backend/lib/extensions/tokens";
import { and, eq, isNull } from "drizzle-orm";

const verifyExtensionAppToken = async (token: string): Promise<{ name: string }> => {
  if (!config.PUBLIC_EXTENSIONS_ENABLED) throw unauthorized();

  const decoded = decodeExtensionToken(token);

  if (decoded.subject !== undefined) throw unauthorized();

  const [row] = await db
    .select({ key: extensionRegistryKeys.key })
    .from(extensionRegistryKeys)
    .where(
      and(
        eq(extensionRegistryKeys.name, decoded.name),
        eq(extensionRegistryKeys.kid, decoded.kid),
        eq(extensionRegistryKeys.current, true),
        isNull(extensionRegistryKeys.revokedAt)
      )
    );

  if (!row?.key) throw unauthorized();

  await verifyExtensionToken(token, row.key, { name: decoded.name, subject: null });

  return { name: decoded.name };
};

export { verifyExtensionAppToken };
