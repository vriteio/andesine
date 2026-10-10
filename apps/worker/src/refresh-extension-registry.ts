import { createClient } from "redis";
import { config } from "./config";
import { isExtensionRegistryEnabled, refreshExtensions } from "./extensions/registry";

// Operator command: refreshes the registry now, for example after a key revocation.
const redis = createClient({ url: config.REDIS_URL });

if (!isExtensionRegistryEnabled()) {
  console.error(
    "Set PUBLIC_EXTENSIONS_ENABLED and EXTENSIONS_REGISTRY_URL to refresh the registry"
  );
  process.exit(1);
}

await redis.connect();

try {
  await refreshExtensions((channel, message) => redis.publish(channel, message));
  console.log("Extension registry refreshed");
} finally {
  await redis.quit();
}

process.exit(0);
