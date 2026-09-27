import { isLiveSource, type PagesConfig } from "../config";
import type { HighlightOptions } from "../content/prepare";
import { createSections, flattenTree } from "../navigation";
import { loadStaticSources, type SourcePage } from "../sources";
import { loadLiveSource } from "../sources/andesine/live";

interface CatalogTopic {
  label: string;
  /** The topic's landing page, or its first page. */
  page: SourcePage;
}

interface CatalogSection {
  label: string;
  /** Pages in navigation order. */
  pages: SourcePage[];
  /** The top-level navigation items. */
  topics: CatalogTopic[];
}

interface Catalog {
  sections: CatalogSection[];
  pages: SourcePage[];
}

/** Lists the public pages of all sources. Pages that are hidden from search are left out. */
const loadCatalog = async (
  config: PagesConfig,
  highlight: HighlightOptions,
  signal?: AbortSignal
): Promise<Catalog> => {
  const [staticSources, liveSources] = await Promise.all([
    loadStaticSources(config),
    Promise.all(
      config.sources
        .filter(isLiveSource)
        .map((source) => loadLiveSource(source, config.base, config.site, highlight, signal))
    )
  ]);
  const sources = [...staticSources, ...liveSources];
  const isPublic = (page?: SourcePage): page is SourcePage => Boolean(page && !page.searchHidden);

  return {
    sections: createSections(config, sources).map((section) => {
      return {
        label: section.label,
        pages: flattenTree(section.navigation)
          .map((node) => node.page)
          .filter(isPublic),
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
