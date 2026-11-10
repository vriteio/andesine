import type { PagesConfig } from "../config";
import type { Catalog } from "./catalog";
import { createPageBody, toLabel, toLine } from "./markdown";

const escapeXML = (value: string): string => {
  return value.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);
};
const createSitemap = (config: PagesConfig, catalog: Catalog): string => {
  const urls = catalog.pages.map((page) => {
    const location = `<loc>${escapeXML(new URL(page.href, config.site).href)}</loc>`;
    const modified = page.updatedAt ? `<lastmod>${page.updatedAt}</lastmod>` : "";

    return `<url>${location}${modified}</url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`;
};
/** The site title, description, and agent instructions, which start both LLM files. */
const createIntroduction = (config: PagesConfig): string[] => {
  return [
    `# ${toLine(config.name)}`,
    ...(config.description ? [`> ${toLine(config.description)}`] : []),
    ...(config.agents.instructions ? [config.agents.instructions] : [])
  ];
};
/** Lists the Markdown alternatives by section, after https://llmstxt.org. */
const createLLMs = (config: PagesConfig, catalog: Catalog): string => {
  const sections = catalog.sections
    .filter((section) => section.pages.length)
    .map((section) => {
      const links = section.pages.map((page) => {
        const url = new URL(`${page.href}index.md`, config.site).href;
        const description = page.description ? `: ${toLine(page.description)}` : "";

        return `- [${toLabel(page.title)}](${url})${description}`;
      });

      return `## ${toLine(section.label)}\n\n${links.join("\n")}`;
    });
  const sectionLinks = config.sections.flatMap((section) => section.links);
  const links = [...config.links, ...sectionLinks, ...(config.cta ? [config.cta] : [])].map(
    (link) => `- [${toLabel(link.label)}](${new URL(link.href, config.site).href})`
  );
  // The llms.txt format marks links that agents can skip as "Optional".
  const optional = links.length ? [`## Optional\n\n${[...new Set(links)].join("\n")}`] : [];

  return `${[...createIntroduction(config), ...sections, ...optional].join("\n\n")}\n`;
};
/** All pages in one file, in navigation order. */
const createLLMsFull = (config: PagesConfig, catalog: Catalog): string => {
  const pages = [...new Set(catalog.sections.flatMap((section) => section.pages))].map((page) => {
    return createPageBody(page, new URL(page.href, config.site).href);
  });

  return `${[...createIntroduction(config), ...pages].join("\n\n")}\n`;
};
/** Crawlers read `robots.txt` only at the domain root, so it has an effect only for `base: "/"`. */
const createRobots = (config: PagesConfig): string => {
  return [
    "User-agent: *",
    `Allow: ${config.base}`,
    `Disallow: ${config.base}_andesine/`,
    `Sitemap: ${new URL(`${config.base}sitemap.xml`, config.site).href}`,
    ""
  ].join("\n");
};

export { createSitemap, createLLMs, createLLMsFull, createRobots };
