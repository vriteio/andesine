import type { PagesConfig, SourceConfig } from "../config";
import { createLinkResolver } from "../navigation/links";
import type { SourceData } from "../sources";
import type { AndesineAPIContext, SearchSourceContext, SiteContext } from "./types";

const defaultAPIURL = "https://api.andesine.app";

/** Direct API access for a source with a publishable key. */
const toAPIContext = (
  config: PagesConfig,
  source: SourceConfig
): AndesineAPIContext | undefined => {
  if (source.type !== "andesine" || !source.publicKey) return undefined;

  return {
    url: (source.apiURL ?? defaultAPIURL).replace(/\/$/, ""),
    key: source.publicKey,
    collection: source.collection,
    channel: source.channel,
    pages: `${config.base}_andesine/pages/${source.id}.json`
  };
};
const createSearchSources = (config: PagesConfig): SearchSourceContext[] => {
  return config.sources.map((source) => {
    return {
      id: source.id,
      label:
        config.sections.find((section) => section.sources.includes(source.id))?.label ??
        config.name,
      type: source.type === "andesine" ? "andesine" : "pagefind",
      api: toAPIContext(config, source)
    };
  });
};
const createSiteContext = (config: PagesConfig, loaded: SourceData[]): SiteContext => {
  const sources = createSearchSources(config);
  const links = createLinkResolver(loaded);
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
    links: links.resolveAll(config.links),
    cta: config.cta && links.resolve(config.cta),
    socialLinks: links.resolveAll(config.socialLinks),
    poweredBy: config.poweredBy,
    search: sources.length
      ? {
          sources,
          endpoint: `${config.base}_andesine/search/`,
          pagefind: `${config.base}pagefind/`,
          answers: answers && {
            endpoint: `${config.base}_andesine/answers/`,
            source: answers.id,
            api: toAPIContext(config, answers)
          }
        }
      : undefined
  };
};

export { createSiteContext };
