import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { textResponse } from "../../output/response";
import { getMarkdownPaths } from "../../site";

export const getStaticPaths = () => getMarkdownPaths(config);

export const GET: APIRoute = ({ props }) => {
  return textResponse((props as { markdown: string }).markdown, "text/markdown");
};
