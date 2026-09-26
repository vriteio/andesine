import { OpenAICompatibleClient, TypesenseClient } from "@andesine/server/search";
import { config } from "#backend/lib/config";

const searchTypesenseClient = new TypesenseClient({
  url: config.TYPESENSE_URL,
  apiKey: config.TYPESENSE_API_KEY
});
const searchOpenAIClient = new OpenAICompatibleClient({
  apiKey: config.OPENAI_API_KEY,
  baseURL: config.OPENAI_BASE_URL,
  embeddingDimensions: config.SEARCH_EMBEDDING_DIMENSIONS,
  embeddingModel: config.SEARCH_EMBEDDING_MODEL
});

export { searchOpenAIClient, searchTypesenseClient };
