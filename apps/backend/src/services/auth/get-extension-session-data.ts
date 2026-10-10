import { publicID, toUUID, toWorkspaceID } from "@andesine/contracts/primitives";
import {
  extensionDevelopmentVersions,
  extensionRegistryKeys,
  extensions,
  workspaces
} from "@andesine/server/database";
import { isExtensionActive } from "@andesine/server/extensions";
import { db } from "#backend/lib/adapters";
import { config } from "#backend/lib/config";
import {
  decodeExtensionToken,
  isExtensionToken,
  unauthorized,
  verifyExtensionToken
} from "#backend/lib/extensions/tokens";
import { type SessionData } from "#backend/lib/policy";
import { and, eq, isNull } from "drizzle-orm";

const extensionIDType = publicID("ext");

/** Disabled or uninstalled extensions get an inactive principal for `inactiveExtensions` routes. */
const getExtensionSessionData = async (token: string): Promise<SessionData> => {
  if (!config.PUBLIC_EXTENSIONS_ENABLED) throw unauthorized();

  const decoded = decodeExtensionToken(token);
  const extensionID = extensionIDType.safeParse(decoded.subject);

  if (!extensionID.success) throw unauthorized();

  const [row] = await db
    .select({
      extension: extensions,
      registryKey: extensionRegistryKeys.key,
      development: extensionDevelopmentVersions.manifest,
      subscriptionPlan: workspaces.subscriptionPlan,
      customerID: workspaces.customerID
    })
    .from(extensions)
    .innerJoin(workspaces, eq(workspaces.id, extensions.workspaceID))
    .leftJoin(
      extensionRegistryKeys,
      and(
        eq(extensionRegistryKeys.name, extensions.name),
        eq(extensionRegistryKeys.kid, decoded.kid),
        eq(extensionRegistryKeys.current, true),
        isNull(extensionRegistryKeys.revokedAt)
      )
    )
    .leftJoin(
      extensionDevelopmentVersions,
      eq(extensionDevelopmentVersions.extensionID, extensions.id)
    )
    .where(
      and(
        eq(extensions.id, toUUID(extensionID.data)),
        eq(extensions.name, decoded.name),
        isNull(workspaces.deletingAt)
      )
    );
  // Development extensions use the development keys of their latest build, never registry keys.
  const developmentKey = config.EXTENSIONS_DEVELOPMENT_ENABLED
    ? row?.development?.manifest.backend?.keys.find(({ kid }) => kid === decoded.kid)
    : undefined;
  const key = row?.extension.development ? developmentKey : row?.registryKey;

  if (!row || !key) throw unauthorized();

  await verifyExtensionToken(token, key, { name: decoded.name, subject: extensionID.data });

  return {
    id: `session:extension:${extensionID.data}`,
    type: "extension",
    workspaceID: toWorkspaceID(row.extension.workspaceID),
    subscriptionPlan: row.subscriptionPlan,
    customerID: row.customerID || undefined,
    extension: {
      extensionID: extensionID.data,
      name: decoded.name,
      version: row.extension.version,
      generation: row.extension.generation,
      permissions: row.extension.permissions,
      active: isExtensionActive(row.extension),
      uninstalled: Boolean(row.extension.uninstalledAt)
    }
  };
};

export { getExtensionSessionData, isExtensionToken };
