import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { loadCatalog } from "../../output/catalog";
import { createSitemap } from "../../output/files";
import { textResponse } from "../../output/response";

export const GET: APIRoute = async () => {
  return textResponse(createSitemap(config, await loadCatalog(config)), "application/xml");
};
