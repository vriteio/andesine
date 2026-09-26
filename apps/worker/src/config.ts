import { encryptionConfigSchema } from "@andesine/server/security/config";
import { webhookDestinationConfigSchema } from "@andesine/server/webhooks/destination/config";
import { searchConfigSchema } from "@andesine/server/search/config";
import { versionRetentionConfigSchema } from "@andesine/server/versioning/config";
import { createWebhookRetentionPolicy } from "@andesine/server/webhooks/retention";
import { billingModeConfigSchema } from "@andesine/server/billing/config";
import { assetConfigSchema } from "@andesine/server/assets/config";
import * as z from "zod";

const configSchema = z
  .object({
    DATABASE_URL: z.string().describe("PostgreSQL connection URL"),
    QUEUE_REDIS_URL: z.string().describe("Background job Redis connection URL"),
    REDIS_URL: z.string().describe("Redis connection URL"),
    ...encryptionConfigSchema.shape,
    ...webhookDestinationConfigSchema.shape,
    ...searchConfigSchema.omit({ SEARCH_ASK_REASONING_EFFORT: true }).shape,
    ...versionRetentionConfigSchema.shape,
    ...billingModeConfigSchema.shape
  })
  .extend({
    ...assetConfigSchema.shape,
    WORKER_CONCURRENCY: z.coerce
      .number()
      .int()
      .min(1)
      .default(4)
      .describe("Maximum number of concurrent jobs"),
    WEBHOOK_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(256).default(4),
    WEBHOOK_GLOBAL_CONCURRENCY: z.coerce.number().int().min(1).max(1024).default(16),
    WEBHOOK_WORKSPACE_CONCURRENCY: z.coerce.number().int().min(1).max(1024).default(4)
  });
const config = configSchema.parse({ ...process.env });

const webhookRetentionPolicy = createWebhookRetentionPolicy(config);

export { config, webhookRetentionPolicy };
