import type { APIRoute } from "astro";
import config from "virtual:andesine/config";
import type { AndesineSourceConfig } from "../../config";
import { textResponse } from "../../output/response";
import { loadAndesineSource } from "../../sources/andesine/stored";

const sources = config.sources.filter((source): source is AndesineSourceConfig => {
  return source.type === "andesine" && Boolean(source.publicKey);
});

export const getStaticPaths = () => sources.map((source) => ({ params: { source: source.id } }));

/**
 * Maps the entry IDs of a source with a publishable key to page URLs, so the browser can link
 * API search results and answer sources. Pages hidden from search are left out.
 */
export const GET: APIRoute = async ({ params }) => {
  const source = sources.find((item) => item.id === params.source)!;
  const { pages } = await loadAndesineSource(source, config.base);
  const hrefs = Object.fromEntries(
    pages.filter((page) => !page.searchHidden).map((page) => [page.id, page.href])
  );

  return textResponse(JSON.stringify(hrefs), "application/json");
};
