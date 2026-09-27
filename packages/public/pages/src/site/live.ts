import { isLiveSource, type PagesConfig } from "../config";
import type { HighlightOptions } from "../content/prepare";
import type { RedirectRoute } from "../routing";
import { toHref } from "../routing";
import { loadStaticSources } from "../sources";
import type { PageSummary } from "../output/not-found";
import { loadLiveSource } from "../sources/andesine/live";
import { createSiteRoutes, toMountHref, type PageRouteData } from ".";

interface NotFoundRoute {
  type: "not-found";
  /** The site's pages, when the path is in a request-time source. */
  pages?: PageSummary[];
}

type LiveRoute = PageRouteData | RedirectRoute | NotFoundRoute;

/** Encodes a request path like page URLs, which browsers encode differently. */
const toRequestHref = (pathname: string): string | undefined => {
  try {
    return toHref(pathname.split("/").filter(Boolean).map(decodeURIComponent));
  } catch {
    return undefined;
  }
};

/** Resolves a request to a request-time source page, with the latest publication. */
const getLiveRoute = async (
  config: PagesConfig,
  highlight: HighlightOptions,
  url: URL,
  signal?: AbortSignal
): Promise<LiveRoute> => {
  const pathname = toRequestHref(url.pathname);
  const source = config.sources
    .filter(isLiveSource)
    .find((item) => pathname?.startsWith(toMountHref(config, item.mount)));

  if (!pathname || !source) return { type: "not-found" };

  const [staticSources, liveSource] = await Promise.all([
    loadStaticSources(config),
    loadLiveSource(source, config.base, config.site, highlight, signal, pathname)
  ]);
  const sources = [...staticSources, liveSource];
  const [match] = createSiteRoutes(config, sources, pathname);

  if (match) return match.route;

  return {
    type: "not-found",
    pages: sources.flatMap((item) => item.pages).map(({ title, href }) => ({ title, href }))
  };
};

export { getLiveRoute };
export type { LiveRoute };
