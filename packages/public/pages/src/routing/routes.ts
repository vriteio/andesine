import type { Section } from "../navigation";
import { flattenTree } from "../navigation";
import type { SourcePage } from "../sources";
import { toHref, toSegments } from "./paths";

interface PageRoute {
  type: "page";
  href: string;
  page: SourcePage;
  section: Section;
}

interface RedirectRoute {
  type: "redirect";
  href: string;
  target: string;
}

type Route = PageRoute | RedirectRoute;

/**
 * Creates one route for each page, and a redirect to the first page for each source mount
 * and the site root without a page. Fails when two pages use the same URL.
 */
const createRoutes = (base: string, sections: Section[]): Route[] => {
  const routes = new Map<string, Route>();
  const addRedirect = (href: string, target?: string): void => {
    const isFree = target && target !== href && !routes.has(href);

    if (isFree) routes.set(href, { type: "redirect", href, target });
  };

  for (const section of sections) {
    for (const page of section.sources.flatMap((source) => source.pages)) {
      const existing = routes.get(page.href);

      if (existing?.type === "page") {
        throw new Error(
          `Pages "${existing.page.sourceID}/${existing.page.id}" and "${page.sourceID}/${page.id}" both use the URL ${page.href}. Change the file location or slug of one page.`
        );
      }

      routes.set(page.href, { type: "page", href: page.href, page, section });
    }
  }

  for (const source of sections.flatMap((section) => section.sources)) {
    addRedirect(source.href, flattenTree(source.navigation)[0]?.page?.href);
  }

  addRedirect(toHref(toSegments(base, "Site base")), sections[0]?.href);

  return [...routes.values()];
};

export { createRoutes };
export type { PageRoute, RedirectRoute, Route };
