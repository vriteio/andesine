// Props whose values show on the page, e.g. a card or callout title.
const textProps = /\b(?:title|description|label|caption)=(["'])(.*?)\1/g;

/** Keeps the text of a JSX tag's visible props, and drops the tag. */
const replaceTag = (tag: string): string => {
  return [...tag.matchAll(textProps)].map((match) => ` ${match[2]} `).join("");
};
/**
 * Turns MDX source into plain text for the development search index, like the text of the
 * rendered page: no ESM statements, JSX tags, or Markdown syntax.
 */
const toSearchText = (source: string): string => {
  return source
    .replace(/^(?:import|export)\s.*$/gm, "")
    .replace(/<\/?[A-Za-z][\w.:-]*(?:\s(?:[^<>"']|"[^"]*"|'[^']*')*)?\/?>/g, replaceTag)
    .replace(/^\s*(?:`{3,}|~{3,}).*$/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, "")
    .replace(/(\*\*|__|\*|_|`)(\S(?:.*?\S)?)\1/g, "$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export { toSearchText };
