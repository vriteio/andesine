import type { MarkdownHeading } from "astro";
import { render } from "astro:content";
import type { Root } from "hast";
import type { PagesConfig } from "../config";
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
import { createRoutes, type RedirectRoute, type Route } from "../routing";
import { prepareMarkdown, type HighlightOptions } from "../content/prepare";
import { loadStaticSources, type SourceData, type SourcePage } from "../sources";
import { toOpenAPIMarkdown } from "../sources/openapi/markdown";
import { createOperationView, type OperationView } from "../sources/openapi/view";

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
  /** The operation of an OpenAPI operation page. */
  operation?: OperationView;
  /** HTML syntax tree of an Andesine page, or of an OpenAPI overview or tag page. */
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

/** Creates the routes of loaded sources, with the page context of each page. */
const createSiteRoutes = (config: PagesConfig, sources: SourceData[]): SiteRoute[] => {
  const sections = createSections(config, sources);
  const site = createSiteContext(config);
  const shownSections = config.sections.length ? sections : [];

  return createRoutes(config.base, sections).map((route: Route) => {
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
              indexed: route.page.content.type !== "andesine" && !route.page.searchHidden,
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
    links: [...site.links, ...(sections[0]?.links ?? [])],
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
const renderRoute = async (
  route: PageRouteData,
  highlight: HighlightOptions
): Promise<RenderedRoute> => {
  if (route.content.type === "openapi" && route.content.operation) {
    const { operation, model, links } = route.content;

    return {
      operation: await createOperationView(operation, model, {
        highlight,
        title: route.context.title,
        href: links.operations[operation.id]!
      }),
      page: { ...route.context, headings: [] }
    };
  }

  // Overview and tag pages show their Markdown.
  if (route.content.type === "openapi") {
    const prepared = await prepareMarkdown(
      toOpenAPIMarkdown(route.content, (href) => href),
      highlight
    );

    return {
      nodes: prepared.nodes,
      iconCSS: prepared.iconCSS,
      page: { ...route.context, headings: toOutline(prepared.headings, route.toc) }
    };
  }

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
  createSiteRoutes,
  getStaticPaths,
  getMarkdownPaths,
  getSocialPaths,
  getNotFoundContext,
  renderRoute
};
export type { SiteRoute, StaticPath, MarkdownPath, SocialPath, RenderedRoute };
