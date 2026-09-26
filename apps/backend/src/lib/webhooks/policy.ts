import { createWebhookRetentionPolicy } from "@andesine/server/webhooks/retention";
import { config } from "#backend/lib/config";

const webhookRetentionPolicy = createWebhookRetentionPolicy(config);

export { webhookRetentionPolicy };
