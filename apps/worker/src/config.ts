import { configSchema as backendConfigSchema } from "@andesine/backend/lib/config-schema";
import * as z from "zod";
import { assetConfigSchema } from "@andesine/backend/lib/assets/config-schema";

const configSchema = backendConfigSchema
  .pick({
    DATABASE_URL: true,
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
      .describe("Maximum number of concurrent jobs")
  });
const config = configSchema.parse({ ...process.env });

export { config };
