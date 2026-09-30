import type { PagesConfig } from "../config";
import type { SearchSourceContext, SiteContext } from "./types";

const createSearchSources = (config: PagesConfig): SearchSourceContext[] => {
  return config.sources.map((source) => {
    return {
      id: source.id,
      label:
        config.sections.find((section) => section.sources.includes(source.id))?.label ??
        config.name,
      type: source.type === "andesine" ? "andesine" : "pagefind"
    };
  });
};
const createSiteContext = (config: PagesConfig): SiteContext => {
  const sources = createSearchSources(config);
  // The API answers about one collection, so the first source with answers is used.
  const answers = config.sources.find((source) => source.type === "andesine" && source.answers);

  return {
    name: config.name,
    description: config.description,
    language: config.language,
    href: config.base,
    url: new URL(config.base, config.site).href,
    storageKey: `andesine:${config.base}`,
    logo: config.logo,
    favicon: config.favicon,
    sectionsDisplay: config.sectionsDisplay,
    links: config.links,
    cta: config.cta,
    socialLinks: config.socialLinks,
    search: sources.length
      ? {
          sources,
          endpoint: `${config.base}_andesine/search/`,
          pagefind: `${config.base}pagefind/`,
          answers: answers && {
            endpoint: `${config.base}_andesine/answers/`,
            source: answers.id
          }
        }
      : undefined
  };
};

export { createSiteContext };
