import { configSchema as backendConfigSchema } from "@andesine/backend/lib/config-schema";
import * as z from "zod";
import { assetConfigSchema } from "@andesine/backend/lib/assets/config-schema";

const configSchema = backendConfigSchema
  .pick({
    DATABASE_URL: true,
    ENCRYPTION_KEYS: true,
    WEBHOOK_ALLOW_HTTP: true,
    WEBHOOK_DESTINATION_EXCEPTIONS: true,
    QUEUE_REDIS_URL: true,
    REDIS_URL: true,
    TYPESENSE_URL: true,
    TYPESENSE_API_KEY: true,
    OPENAI_API_KEY: true,
    OPENAI_BASE_URL: true,
    ASSET_ANALYSIS_MODEL: true,
    SEARCH_ASK_MODEL: true,
    SEARCH_EMBEDDING_MODEL: true,
    SEARCH_EMBEDDING_DIMENSIONS: true
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

export { config };
