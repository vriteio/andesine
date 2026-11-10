import type { PagesConfig } from "../config";
import { createSections, flattenTree } from "../navigation";
import { loadStaticSources, type SourcePage } from "../sources";

interface CatalogTopic {
  label: string;
  /** The topic's landing page, or its first page. */
  page: SourcePage;
}

interface CatalogSection {
  label: string;
  /** Pages in navigation order, followed by pages hidden from navigation. */
  pages: SourcePage[];
  /** The top-level navigation items. */
  topics: CatalogTopic[];
}

interface Catalog {
  sections: CatalogSection[];
  pages: SourcePage[];
}

/** Lists the public pages of all sources. Pages that are hidden from search are left out. */
const loadCatalog = async (config: PagesConfig): Promise<Catalog> => {
  const sources = await loadStaticSources(config);
  const isPublic = (page?: SourcePage): page is SourcePage => Boolean(page && !page.searchHidden);

  return {
    sections: createSections(config, sources).map((section) => {
      const pages = [
        ...flattenTree(section.navigation).map((node) => node.page),
        ...section.sources.flatMap((source) => source.pages)
      ].filter(isPublic);

      return {
        label: section.label,
        pages: [...new Set(pages)],
        topics: section.navigation.flatMap((node) => {
          const page = flattenTree([node])
            .map((item) => item.page)
            .find(isPublic);

          return page ? [{ label: node.label, page }] : [];
        })
      };
    }),
    pages: sources.flatMap((source) => source.pages).filter(isPublic)
  };
};

export { loadCatalog };
export type { Catalog, CatalogSection, CatalogTopic };
