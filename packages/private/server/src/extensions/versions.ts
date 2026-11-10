import { compareExtensionVersions } from "@andesine/contracts/extensions/registry";
import { extensionRegistryVersions, type DatabaseClient } from "@andesine/server/database";
import { and, eq, isNull } from "drizzle-orm";

type RegistryVersion = typeof extensionRegistryVersions.$inferSelect;

/** Newest non-revoked, non-prerelease version per name; ingestion stores only compatible ones. */
const getLatestVersions = async (
  database: DatabaseClient,
  name?: string
): Promise<RegistryVersion[]> => {
  const versions = await database
    .select()
    .from(extensionRegistryVersions)
    .where(
      and(
        name ? eq(extensionRegistryVersions.name, name) : undefined,
        isNull(extensionRegistryVersions.revokedAt)
      )
    );
  const latest = new Map<string, RegistryVersion>();

  for (const version of versions.filter(({ version }) => !version.includes("-"))) {
    const current = latest.get(version.name);

    if (!current || compareExtensionVersions(version.version, current.version) > 0) {
      latest.set(version.name, version);
    }
  }

  return [...latest.values()].sort((a, b) => a.name.localeCompare(b.name));
};
const getLatestVersion = async (
  database: DatabaseClient,
  name: string
): Promise<RegistryVersion | null> => {
  return (await getLatestVersions(database, name))[0] ?? null;
};

export { compareExtensionVersions, getLatestVersion, getLatestVersions };
