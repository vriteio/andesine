import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { createRobots } from "../../output/files";
import { textResponse } from "../../output/response";

export const GET: APIRoute = () => textResponse(createRobots(config), "text/plain");
