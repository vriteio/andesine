import {
  extensionConfigurations,
  extensionDevelopmentVersions,
  extensionElementViews,
  extensionSecrets,
  extensionStorage,
  type DatabaseTransaction,
  type extensions
} from "@andesine/server/database";
import { eq } from "drizzle-orm";
import { transitionExtension } from "./lifecycle";

/** Deletes a locked extension's data and keeps its record as a tombstone the backend can read. */
const uninstallExtension = async (
  database: DatabaseTransaction,
  extension: typeof extensions.$inferSelect
): Promise<typeof extensions.$inferSelect> => {
  await database.delete(extensionStorage).where(eq(extensionStorage.extensionID, extension.id));
  await database
    .delete(extensionConfigurations)
    .where(eq(extensionConfigurations.extensionID, extension.id));
  await database.delete(extensionSecrets).where(eq(extensionSecrets.extensionID, extension.id));
  await database
    .delete(extensionElementViews)
    .where(eq(extensionElementViews.extensionID, extension.id));
  // The build's manifest stays: it holds the development keys the backend authenticates with.
  await database
    .update(extensionDevelopmentVersions)
    .set({ frontend: "", styles: null, icons: null })
    .where(eq(extensionDevelopmentVersions.extensionID, extension.id));

  return transitionExtension(database, extension, {
    event: "extension.uninstalled",
    set: { enabled: false, disabledReason: null, uninstalledAt: new Date() }
  });
};

export { uninstallExtension };
