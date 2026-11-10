import { createSearchCollectionDefinitions, TypesenseClient } from "@andesine/server/search";
import { config } from "../config";

const typesenseClient = new TypesenseClient({
  url: config.TYPESENSE_URL,
  apiKey: config.TYPESENSE_API_KEY
});
const searchCollectionDefinitions = createSearchCollectionDefinitions({
  dimensions: config.SEARCH_EMBEDDING_DIMENSIONS
});

export { searchCollectionDefinitions, typesenseClient };
