import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import { textResponse } from "../../output/response";
import { getMarkdownPaths } from "../../site";

// Agents often add `.md` to a page URL: `/guide/` becomes `/guide.md`. The home page has no alias.
export const getStaticPaths = async () => {
  return (await getMarkdownPaths(config)).filter((path) => path.params.path);
};

export const GET: APIRoute = ({ props }) => {
  return textResponse((props as { markdown: string }).markdown, "text/markdown");
};
