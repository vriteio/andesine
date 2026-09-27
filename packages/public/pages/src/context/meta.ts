import type { PageMeta, SiteContext } from "./types";

/** The document title, description, and type of a page. */
const createPageMeta = (
  site: SiteContext,
  page: { title: string; description?: string; href?: string }
): PageMeta => {
  return {
    title: page.title === site.name ? site.name : `${page.title} | ${site.name}`,
    description: page.description ?? site.description,
    type: page.href === site.href ? "website" : "article"
  };
};

export { createPageMeta };
