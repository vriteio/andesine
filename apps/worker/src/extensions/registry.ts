import { createExtensionLifecycle, refreshExtensionRegistry } from "@andesine/server/extensions";
import { config, webhookRetentionPolicy } from "../config";
import { db } from "../database";
import { type PublishEvent } from "../webhooks/events";

const EXTENSION_REGISTRY_JOB_NAME = "extension-registry-refresh";
const extensionLifecycle = createExtensionLifecycle({ retentionPolicy: webhookRetentionPolicy });
const isExtensionRegistryEnabled = (): boolean => {
  return config.PUBLIC_EXTENSIONS_ENABLED && Boolean(config.EXTENSIONS_REGISTRY_URL);
};
const refreshExtensions = async (publish: PublishEvent): Promise<void> => {
  const result = await refreshExtensionRegistry({
    database: db,
    url: config.EXTENSIONS_REGISTRY_URL!,
    lifecycle: extensionLifecycle
  });

  for (const { workspaceID, extensionID } of result.updated) {
    const event = { action: "extension:update", data: { id: extensionID } };

    await publish(`${workspaceID}:extensions`, JSON.stringify(event));
  }

  if (result.rejected.length) {
    console.warn("Extension registry entries were rejected", { rejected: result.rejected });
  }
};

export { EXTENSION_REGISTRY_JOB_NAME, isExtensionRegistryEnabled, refreshExtensions };
