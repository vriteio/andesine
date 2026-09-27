import type { APIRoute } from "astro";
import config, { highlight, skill } from "virtual:andesine/config";
import { isLiveSource } from "../../config";
import { loadCatalog } from "../../output/catalog";
import { textResponse, unavailableResponse } from "../../output/response";
import { loadSkill } from "../../output/skill";

export const GET: APIRoute = async ({ request }) => {
  try {
    const { content } = await loadSkill(config, skill, () => {
      return loadCatalog(config, highlight, request.signal);
    });

    return textResponse(content, "text/markdown");
  } catch (error) {
    // A static build must fail instead of writing an outage response.
    if (import.meta.env.PROD && !config.sources.some(isLiveSource)) throw error;

    return unavailableResponse(error);
  }
};
