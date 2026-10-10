import { type ExtensionVersionManifest } from "@andesine/contracts/extensions";
import {
  extensionDevelopmentVersions,
  extensionRegistryVersions,
  type extensions,
  type DatabaseClient
} from "@andesine/server/database";
import { and, eq } from "drizzle-orm";

interface ExtensionVersion {
  manifest: ExtensionVersionManifest;
  revoked: boolean;
}

type ExtensionRow = typeof extensions.$inferSelect;

/** The active version: the registry version, or a development extension's current build. */
const getExtensionVersion = async (
  database: DatabaseClient,
  extension: ExtensionRow
): Promise<ExtensionVersion | null> => {
  if (extension.development) {
    const [build] = await database
      .select({ manifest: extensionDevelopmentVersions.manifest })
      .from(extensionDevelopmentVersions)
      .where(
        and(
          eq(extensionDevelopmentVersions.extensionID, extension.id),
          eq(extensionDevelopmentVersions.version, extension.version)
        )
      );

    return build ? { manifest: build.manifest, revoked: false } : null;
  }

  const [version] = await database
    .select({
      manifest: extensionRegistryVersions.manifest,
      revokedAt: extensionRegistryVersions.revokedAt
    })
    .from(extensionRegistryVersions)
    .where(
      and(
        eq(extensionRegistryVersions.name, extension.name),
        eq(extensionRegistryVersions.version, extension.version)
      )
    );

  return version ? { manifest: version.manifest, revoked: version.revokedAt !== null } : null;
};
const getExtensionManifest = async (
  database: DatabaseClient,
  extension: ExtensionRow
): Promise<ExtensionVersionManifest["manifest"] | null> => {
  return (await getExtensionVersion(database, extension))?.manifest.manifest ?? null;
};

export { getExtensionVersion, getExtensionManifest };
export type { ExtensionVersion };
