import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { loadCatalog } from "../../output/catalog";
import { createLLMsFull } from "../../output/files";
import { textResponse } from "../../output/response";

export const GET: APIRoute = async () => {
  return textResponse(createLLMsFull(config, await loadCatalog(config)), "text/plain");
};
