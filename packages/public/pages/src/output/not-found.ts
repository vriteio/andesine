import type { PagesConfig } from "../config";
import { createAgentNote, toLine } from "./markdown";

interface PageSummary {
  title: string;
  href: string;
}

const toWords = (value: string): string[] => {
  return decodeURIComponent(value)
    .toLowerCase()
    .replace(/(?:\/index)?\.md$/, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1);
};
/** Pages whose URL or title shares the most words with the path, for up to three links. */
const findRelated = (path: string, pages: PageSummary[]): PageSummary[] => {
  const words = new Set(toWords(path));

  return pages
    .map((page) => {
      return {
        page,
        score: [...new Set([...toWords(page.href), ...toWords(page.title)])].filter((word) => {
          return words.has(word);
        }).length
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.page.href.length - b.page.href.length)
    .slice(0, 3)
    .map((item) => item.page);
};
/** A Markdown 404 that helps agents find the right page. */
const createMarkdownNotFound = (config: PagesConfig, url: URL, pages: PageSummary[]): string => {
  const related = findRelated(url.pathname, pages).map(
    (page) => `- [${toLine(page.title)}](${new URL(`${page.href}index.md`, config.site).href})`
  );
  const full = new URL(`${config.base}llms-full.txt`, config.site).href;

  return `${[
    createAgentNote(config),
    "# Page not found",
    `No page exists at ${url.pathname}. All pages in one file: ${full}`,
    ...(related.length ? [`## Related pages\n\n${related.join("\n")}`] : [])
  ].join("\n\n")}\n`;
};

export { createMarkdownNotFound };
export type { PageSummary };
