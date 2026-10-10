import { extensions, type Database } from "@andesine/server/database";
import { and, eq, isNull } from "drizzle-orm";
import { type ExtensionLifecycle, type UpdatedExtension } from "./lifecycle";
import {
  fetchExtensionRegistry,
  ingestExtensionRegistry,
  type ExtensionRegistryIngestion
} from "./registry";

interface RefreshExtensionRegistryInput {
  database: Database;
  /** The configured registry URL, which is also the source identity of its records. */
  url: string;
  lifecycle: ExtensionLifecycle;
}
interface ExtensionRegistryRefresh extends ExtensionRegistryIngestion {
  /** Installations that changed, for `extension:update` events. */
  updated: UpdatedExtension[];
}

/**
 * Stores the registry, then updates every installation, which completes interrupted refreshes.
 * A failed fetch throws before any change, keeping the last valid state and revocations.
 */
const refreshExtensionRegistry = async (
  input: RefreshExtensionRegistryInput
): Promise<ExtensionRegistryRefresh> => {
  const index = await fetchExtensionRegistry(input.url);
  const ingestion = await ingestExtensionRegistry(input.database, input.url, index);
  const installed = await input.database
    .selectDistinct({ name: extensions.name })
    .from(extensions)
    .where(and(eq(extensions.development, false), isNull(extensions.uninstalledAt)));
  const updated: UpdatedExtension[] = [];

  for (const { name } of installed) {
    updated.push(...(await input.lifecycle.updateExtensions(input.database, name)));
  }

  return { ...ingestion, updated };
};

export { refreshExtensionRegistry };
export type { ExtensionRegistryRefresh };
