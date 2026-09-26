import * as z from "zod";

const instanceInfoType = z.object({
  apiVersion: z.string().describe("API contract version, not the server build version"),
  features: z
    .object({
      imageStorage: z.boolean(),
      semanticSearch: z.boolean(),
      aiAnswers: z.boolean().describe("Whether AI answers are configured"),
      aiAnswerStreaming: z.boolean().describe("Whether streaming AI answers are configured")
    })
    .describe("Configured availability; does not imply permission or current service health"),
  limits: z.object({
    maxUploadBytes: z.number().int().positive(),
    assetStorageBytes: z.number().int().positive(),
    defaultPageSize: z.number().int().positive(),
    maxPageSize: z.number().int().positive(),
    maxBulkItems: z.number().int().positive(),
    maxSearchResults: z.number().int().positive()
  })
});

export { instanceInfoType };
