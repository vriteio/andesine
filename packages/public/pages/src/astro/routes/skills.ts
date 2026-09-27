import type { APIRoute } from "astro";
import config, { highlight, skill } from "virtual:andesine/config";
import { isLiveSource } from "../../config";
import { loadCatalog } from "../../output/catalog";
import { textResponse, unavailableResponse } from "../../output/response";
import {
  createAgentSkillsIndex,
  createSkillsIndex,
  loadSkill,
  readSkill,
  toSkillName,
  type Skill
} from "../../output/skill";

const name = skill ? readSkill(skill).name : toSkillName(config.name);
// The agentskills.io discovery index, and the index of the `skills` CLI, with their files.
const files: Record<string, (skill: Skill) => Response | Promise<Response>> = {
  "agent-skills/index.json": async (loaded) => {
    return textResponse(await createAgentSkillsIndex(config, loaded), "application/json");
  },
  [`agent-skills/${name}/SKILL.md`]: (loaded) => textResponse(loaded.content, "text/markdown"),
  "skills/index.json": (loaded) => textResponse(createSkillsIndex(loaded), "application/json"),
  [`skills/${name}/SKILL.md`]: (loaded) => textResponse(loaded.content, "text/markdown")
};

export const getStaticPaths = () => Object.keys(files).map((path) => ({ params: { path } }));

export const GET: APIRoute = async ({ params, request }) => {
  const file = files[params.path ?? ""];

  if (!file) return textResponse("Not found", "text/plain", { status: 404 });

  try {
    return await file(
      await loadSkill(config, skill, () => loadCatalog(config, highlight, request.signal))
    );
  } catch (error) {
    // A static build must fail instead of writing an outage response.
    if (import.meta.env.PROD && !config.sources.some(isLiveSource)) throw error;

    return unavailableResponse(error);
  }
};
