import type { APIRoute } from "astro";
import config, { skill } from "virtual:andesine/config";
import { loadCatalog } from "../../output/catalog";
import { textResponse } from "../../output/response";
import { loadSkill } from "../../output/skill";

export const GET: APIRoute = async () => {
  const { content } = await loadSkill(config, skill, () => loadCatalog(config));

  return textResponse(content, "text/markdown");
};
