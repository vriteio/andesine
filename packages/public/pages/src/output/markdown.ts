import type { PagesConfig } from "../config";
import type { SourcePage } from "../sources";

const toLine = (value: string): string => value.replace(/\s+/g, " ").trim();
/** Text for Markdown link labels, with brackets and backslashes escaped. */
const toLabel = (value: string): string => toLine(value).replace(/[[\]\\]/g, "\\$&");
const toQuote = (text: string): string => {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
};
const getLLMsURL = (config: PagesConfig): string => {
  return new URL(`${config.base}llms.txt`, config.site).href;
};
/** Tells agents on a single page where the index is, with the site's agent instructions. */
const createAgentNote = (config: PagesConfig): string => {
  const index = [
    "## Documentation index",
    "",
    `Fetch the complete documentation index at: ${getLLMsURL(config)}`,
    "Use it to find all pages before you explore further."
  ];
  const instructions = config.agents.instructions
    ? ["", "## Agent instructions", "", config.agents.instructions]
    : [];

  return toQuote([...index, ...instructions].join("\n"));
};
/** A page's Markdown, with its title, description, and optional source URL. */
const createPageBody = (page: SourcePage, source?: string): string => {
  const title = `# ${toLine(page.title)}`;
  const url = source && `Source: ${source}`;
  const description = page.description && `> ${toLine(page.description)}`;

  return [title, url, description, page.markdown].filter(Boolean).join("\n\n");
};
const createMarkdownPage = (config: PagesConfig, page: SourcePage): string => {
  return `${createAgentNote(config)}\n\n${createPageBody(page)}\n`;
};

export { toLine, toLabel, getLLMsURL, createAgentNote, createPageBody, createMarkdownPage };
