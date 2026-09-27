import type { APIRoute } from "astro";
import config, { highlight } from "virtual:andesine/config";
import { isLiveSource } from "../../config";
import { loadCatalog } from "../../output/catalog";
import { createLLMsFull } from "../../output/files";
import { textResponse, unavailableResponse } from "../../output/response";

export const GET: APIRoute = async ({ request }) => {
  try {
    return textResponse(
      createLLMsFull(config, await loadCatalog(config, highlight, request.signal)),
      "text/plain"
    );
  } catch (error) {
    // A static build must fail instead of writing an outage response.
    if (import.meta.env.PROD && !config.sources.some(isLiveSource)) {
      throw error;
    }

    return unavailableResponse(error);
  }
};
