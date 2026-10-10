import { createExtensionLifecycle } from "@andesine/server/extensions";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";

const { transitionExtension, updateExtension, updateExtensions } = createExtensionLifecycle({
  retentionPolicy: webhookRetentionPolicy
});

export { transitionExtension, updateExtension, updateExtensions };
