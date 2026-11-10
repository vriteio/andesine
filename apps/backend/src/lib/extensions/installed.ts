import { type ExtensionVersionManifest } from "@andesine/contracts/extensions";
import { toUUID } from "@andesine/contracts/primitives";
import {
  extensionDevelopmentVersions,
  extensionRegistryVersions,
  extensions,
  type DatabaseClient
} from "@andesine/server/database";
import { config } from "#backend/lib/config";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";
import { and, asc, eq, or, type SQL } from "drizzle-orm";

interface InstalledExtension {
  extension: typeof extensions.$inferSelect;
  version: ExtensionVersionManifest;
}

/** Extensions with their active registry or development version; others are left out. */
const listInstalledExtensions = async (
  database: DatabaseClient,
  where: SQL | undefined
): Promise<InstalledExtension[]> => {
  const rows = await database
    .select({
      extension: extensions,
      registry: extensionRegistryVersions.manifest,
      development: extensionDevelopmentVersions.manifest
    })
    .from(extensions)
    .leftJoin(
      extensionRegistryVersions,
      and(
        eq(extensionRegistryVersions.name, extensions.name),
        eq(extensionRegistryVersions.version, extensions.version)
      )
    )
    .leftJoin(
      extensionDevelopmentVersions,
      and(
        eq(extensionDevelopmentVersions.extensionID, extensions.id),
        eq(extensionDevelopmentVersions.version, extensions.version)
      )
    )
    .where(where)
    .orderBy(asc(extensions.name));

  return rows.flatMap(({ extension, registry, development }) => {
    const version = registry ?? development;

    return version ? [{ extension, version }] : [];
  });
};
/** Development extensions are visible only to their developer, while development is enabled. */
const isVisibleExtension = (auth: SessionData): SQL => {
  const isRegistryExtension = eq(extensions.development, false);
  const memberID = getUserAuthorization(auth)?.memberID;

  if (!config.EXTENSIONS_DEVELOPMENT_ENABLED || !memberID) return isRegistryExtension;

  return or(isRegistryExtension, eq(extensions.developerID, toUUID(memberID)))!;
};

export { listInstalledExtensions, isVisibleExtension };
export type { InstalledExtension };
