import type { MarkdownHeading } from "astro";
import { render } from "astro:content";
import type { Root } from "hast";
import { isLiveSource, type PagesConfig } from "../config";
import {
  createPageContext,
  createPageMeta,
  createSiteContext,
  toSectionContexts,
  type HeadingContext,
  type PageContext
} from "../context";
import { createNavigationItems, createSections } from "../navigation";
import { getSocialImage } from "../context/image";
import type { SocialCardData } from "../social/types";
import { createMarkdownPage } from "../output/markdown";
import { createRoutes, toHref, toSegments, type RedirectRoute, type Route } from "../routing";
import { loadStaticSources, type SourceData, type SourcePage } from "../sources";

interface PageRouteData {
  type: "page";
  content: SourcePage["content"];
  toc: boolean;
  sourceID: string;
  /** The page is in the Pagefind index. */
  indexed: boolean;
  /** The Markdown alternative, with the title and description. */
  markdown: string;
  context: Omit<PageContext, "headings">;
}

interface SiteRoute {
  href: string;
  route: PageRouteData | RedirectRoute;
}

interface StaticPath {
  params: { path?: string };
  props: { route: PageRouteData | RedirectRoute };
}

interface MarkdownPath {
  params: { path?: string };
  props: { markdown: string };
}

interface SocialPath {
  params: { path?: string };
  props: { data: SocialData };
}

interface RenderedRoute {
  /** Astro content of a file page. */
  Content?: unknown;
  /** HTML syntax tree of an Andesine page. */
  nodes?: Root;
  summary?: Root;
  aside?: Root;
  /** CSS for icons in the Andesine content. */
  iconCSS?: string;
  page: PageContext;
}

/** Card data without the configured images and brand, which the route adds. */
type SocialData = Omit<
  SocialCardData,
  "logo" | "showSiteName" | "logoFormat" | "background" | "brand"
>;

/** Decodes a base-prefixed URL path into the `[...path]` parameter. */
const toParam = (href: string, base: string): string | undefined => {
  return decodeURIComponent(href.slice(base.length)).replace(/\/$/, "") || undefined;
};

/** The URL path of a source mount. */
const toMountHref = (config: PagesConfig, mount: string): string => {
  return toHref(toSegments(config.base, "Site base"), toSegments(mount, "Mount"));
};
/**
 * Creates the routes of loaded sources, with the page context of each page. With `href`, only
 * the route at that URL is created.
 */
const createSiteRoutes = (
  config: PagesConfig,
  sources: SourceData[],
  href?: string
): SiteRoute[] => {
  const sections = createSections(config, sources);
  const site = createSiteContext(config);
  const shownSections = config.sections.length ? sections : [];
  const routes = createRoutes(config.base, sections).filter((route) => {
    return href === undefined || route.href === href;
  });

  return routes.map((route: Route) => {
    return {
      href: route.href,
      route:
        route.type === "redirect"
          ? route
          : {
              type: "page",
              content: route.page.content,
              toc: route.page.toc,
              sourceID: route.page.sourceID,
              indexed: route.page.content.type === "file" && !route.page.searchHidden,
              markdown: createMarkdownPage(config, route.page),
              context: createPageContext({
                site,
                sections: shownSections,
                route,
                pageActions: config.pageActions,
                image: getSocialImage(config, route.href)
              })
            }
    };
  });
};
const getStaticPaths = async (config: PagesConfig): Promise<StaticPath[]> => {
  const routes = createSiteRoutes(config, await loadStaticSources(config));
  const liveMounts = config.sources
    .filter(isLiveSource)
    .map((source) => toMountHref(config, source.mount));
  // Request-time sources own their mounts, so a built page there would never show.
  const hidden = routes.find(({ href }) => liveMounts.some((mount) => href.startsWith(mount)));

  if (hidden) {
    throw new Error(
      `The page at ${hidden.href} is in the mount of a request-time source. Move the page or change the mount.`
    );
  }

  return routes.map(({ href, route }) => {
    return {
      params: { path: toParam(href, config.base) },
      props: { route }
    };
  });
};
const getMarkdownPaths = async (config: PagesConfig): Promise<MarkdownPath[]> => {
  const routes = createSiteRoutes(config, await loadStaticSources(config));

  return routes.flatMap(({ href, route }) => {
    return route.type === "page"
      ? [{ params: { path: toParam(href, config.base) }, props: { markdown: route.markdown } }]
      : [];
  });
};
const toSocialData = (context: PageRouteData["context"]): SocialData => {
  return {
    siteName: context.site.name,
    title: context.title,
    description: context.description,
    group: context.breadcrumbs.at(-1)?.label
  };
};
const getSocialPaths = async (config: PagesConfig): Promise<SocialPath[]> => {
  const routes = createSiteRoutes(config, await loadStaticSources(config));

  return routes.flatMap(({ href, route }) => {
    return route.type === "page"
      ? [
          {
            params: { path: toParam(href, config.base) },
            props: { data: toSocialData(route.context) }
          }
        ]
      : [];
  });
};
/** The context of the not-found page, with the navigation of the first section. */
const getNotFoundContext = async (config: PagesConfig): Promise<PageContext> => {
  const sections = createSections(config, await loadStaticSources(config));

  const site = createSiteContext(config);
  const title = "Page not found";

  return {
    site,
    title,
    meta: createPageMeta(site, { title }),
    fragments: { summary: false, aside: false },
    layout: "docs",
    sections: config.sections.length ? toSectionContexts(sections) : [],
    navigation: createNavigationItems(sections[0]?.navigation ?? [], []),
    breadcrumbs: [],
    headings: [],
    noindex: true,
    image: getSocialImage(config)
  };
};
const toOutline = (headings: HeadingContext[], toc: boolean): HeadingContext[] => {
  return toc ? headings.filter((heading) => heading.depth >= 2 && heading.depth <= 3) : [];
};
const renderRoute = async (route: PageRouteData): Promise<RenderedRoute> => {
  if (route.content.type === "andesine") {
    return {
      nodes: route.content.nodes,
      summary: route.content.summary,
      aside: route.content.aside,
      iconCSS: route.content.iconCSS,
      page: { ...route.context, headings: toOutline(route.content.headings, route.toc) }
    };
  }

  const { Content, headings } = (await render(route.content.entry)) as {
    Content: unknown;
    headings: MarkdownHeading[];
  };
  const outline = headings.map((heading) => {
    return {
      id: heading.slug,
      text: heading.text,
      depth: heading.depth
    };
  });

  return { Content, page: { ...route.context, headings: toOutline(outline, route.toc) } };
};

export {
  toMountHref,
  createSiteRoutes,
  getStaticPaths,
  getMarkdownPaths,
  getSocialPaths,
  getNotFoundContext,
  renderRoute,
  toSocialData
};
export type { PageRouteData, SiteRoute, StaticPath, MarkdownPath, SocialPath, RenderedRoute };
