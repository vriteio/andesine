import type { PagesConfig, SourceConfig } from "../config";
import { createLinkResolver } from "../navigation/links";
import type { SourceData } from "../sources";
import type {
  AndesineAPIContext,
  SearchContext,
  SearchSourceContext,
  SiteContext,
  WebMCPContext
} from "./types";

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
/** Undefined when no source is searchable. */
const createSearchContext = (config: PagesConfig): SearchContext | undefined => {
  const sources = createSearchSources(config);
  // The API answers about one collection, so the first source with answers is used.
  const answers = config.sources.find((source) => source.type === "andesine" && source.answers);

  if (!sources.length) return undefined;

  return {
    sources,
    endpoint: `${config.base}_andesine/search/`,
    pagefind: `${config.base}pagefind/`,
    answers: answers && {
      endpoint: `${config.base}_andesine/answers/`,
      source: answers.id,
      api: toAPIContext(config, answers)
    }
  };
};
const createWebMCPContext = (config: PagesConfig): WebMCPContext => {
  return { base: config.base, search: createSearchContext(config) };
};
const createSiteContext = (config: PagesConfig, loaded: SourceData[]): SiteContext => {
  const links = createLinkResolver(loaded);

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
    search: createSearchContext(config)
  };
};

export { createSiteContext, createWebMCPContext };
