import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { createWebMCPContext } from "../../context";
import { textResponse } from "../../output/response";

export const GET: APIRoute = () => {
  return textResponse(JSON.stringify(createWebMCPContext(config)), "application/json");
};
