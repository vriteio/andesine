import { marked, Renderer, type Tokens } from "marked";
import type { Answer } from "./types";

const escapeHTML = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};
const isRelative = (href: string): boolean => href.startsWith("#") || /^\/(?!\/)/.test(href);
const isSafeLink = (href: string): boolean => {
  if (isRelative(href)) return true;

  try {
    return ["http:", "https:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
};
const renderer = new Renderer();
/** Links `[n]` references to the cited pages; references without a page stay text. */
const linkReferences = (answer: Answer): string => {
  const hrefs = new Map(answer.sources.map((source) => [String(source.id), source.href]));

  return answer.text.replace(/\[(\d+)\](?!\()/g, (reference, id: string) => {
    const href = hrefs.get(id);

    return href ? `[${reference}](${href})` : reference;
  });
};
/**
 * Renders answer Markdown to HTML. Raw HTML and images become text, and only relative, web
 * and mail links stay links, so the result is safe for `innerHTML`.
 */
const renderAnswer = (answer: Answer): string => {
  return marked.parse(linkReferences(answer), { async: false, breaks: true, gfm: true, renderer });
};

renderer.html = ({ text }: Tokens.HTML | Tokens.Tag): string => escapeHTML(text);
renderer.image = ({ text }: Tokens.Image): string => escapeHTML(text);
renderer.link = function ({ href, title, tokens }: Tokens.Link): string {
  const label = this.parser.parseInline(tokens);

  if (!isSafeLink(href)) return label;

  const titleAttribute = title ? ` title="${escapeHTML(title)}"` : "";
  const externalAttributes = isRelative(href) ? "" : ' target="_blank" rel="noopener noreferrer"';

  return `<a href="${escapeHTML(href)}"${titleAttribute}${externalAttributes}>${label}</a>`;
};

export { renderAnswer };
