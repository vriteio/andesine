import * as z from "zod";

const url = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  return value.replace(/\/+$/, "");
}, z.url());
const searchConfigSchema = z.object({
  TYPESENSE_URL: url.describe("Typesense API URL"),
  TYPESENSE_API_KEY: z.string().min(1).describe("Typesense API key"),
  OPENAI_API_KEY: z.string().min(1).describe("OpenAI-compatible API key"),
  OPENAI_BASE_URL: url
    .default("https://api.openai.com/v1")
    .describe("OpenAI-compatible API base URL"),
  SEARCH_EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default("text-embedding-3-small")
    .describe("OpenAI-compatible embedding model"),
  SEARCH_EMBEDDING_DIMENSIONS: z.coerce
    .number()
    .int()
    .min(1)
    .default(1536)
    .describe("Number of dimensions returned by the embedding model"),
  ASSET_ANALYSIS_MODEL: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Vision model for image analysis; defaults to SEARCH_ASK_MODEL"),
  SEARCH_ASK_MODEL: z
    .string()
    .min(1)
    .default("gpt-5.6-luna")
    .describe("OpenAI-compatible model used by Ask AI"),
  SEARCH_ASK_REASONING_EFFORT: z
    .enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"])
    .default("none")
    .describe("Reasoning effort used by Ask AI")
});

export { searchConfigSchema };
