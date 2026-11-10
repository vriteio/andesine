import type { PagesConfig } from "../config";
import { createNavigationItems, findTrail, flattenTree, type Section } from "../navigation";
import type { PageRoute } from "../routing";
import type { SourceNode } from "../sources";
import { createPageActions } from "./actions";
import { createPageMeta } from "./meta";
import { createStructuredData } from "./structured-data";
import type { PageContext, PageLink, SectionContext, SiteContext, SocialImage } from "./types";

interface PageContextOptions {
  site: SiteContext;
  /** Configured sections; empty when the site uses the implicit section. */
  sections: Section[];
  route: PageRoute;
  pageActions: PagesConfig["pageActions"];
  image?: SocialImage;
}

const toPageLink = (node?: SourceNode): PageLink | undefined => {
  return node?.page && { label: node.label, href: node.page.href };
};
const toSectionContexts = (sections: Section[], current?: Section): SectionContext[] => {
  return sections.map((item) => {
    return {
      id: item.id,
      label: item.label,
      icon: item.icon,
      href: item.href,
      current: item === current
    };
  });
};

/** Creates the page context without headings, which exist only after rendering. */
const createPageContext = (options: PageContextOptions): Omit<PageContext, "headings"> => {
  const { page, section } = options.route;
  const trail = findTrail(section.navigation, page);
  const order = flattenTree(section.navigation);
  const position = order.findIndex((node) => node.page === page);
  const markdown = `${page.href}index.md`;
  const canonical = new URL(page.href, options.site.url).href;
  const breadcrumbs = trail.slice(0, -1).map((node) => {
    return {
      label: node.label,
      href: node.page?.href
    };
  });
  const sectionItem = options.sections.length ? [{ label: section.label, href: section.href }] : [];

  return {
    site: options.site,
    title: page.title,
    description: page.description,
    meta: createPageMeta(options.site, page),
    fragments: {
      summary: page.content.type === "andesine" && Boolean(page.content.summary),
      aside: page.content.type === "andesine" && Boolean(page.content.aside)
    },
    layout: page.layout,
    sections: toSectionContexts(options.sections, section),
    links: [...options.site.links, ...section.links],
    navigation: createNavigationItems(section.navigation, trail),
    breadcrumbs,
    previous: position > 0 ? toPageLink(order[position - 1]) : undefined,
    next: position >= 0 ? toPageLink(order[position + 1]) : undefined,
    canonical,
    markdown,
    updatedAt: page.updatedAt,
    noindex: page.searchHidden,
    image: options.image,
    structuredData: createStructuredData({
      site: options.site,
      title: page.title,
      description: page.description,
      url: canonical,
      updatedAt: page.updatedAt,
      image: options.image?.url,
      trail: [...sectionItem, ...breadcrumbs, { label: page.title, href: page.href }]
    }),
    actions: createPageActions(options.pageActions, new URL(markdown, options.site.url).href)
  };
};

export { createPageContext, toSectionContexts };
