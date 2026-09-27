interface MatchPart {
  text: string;
  /** The part matches the query. */
  match: boolean;
}

interface MatchPreviewOptions {
  /** Maximum length of the preview, in characters. */
  length?: number;
  /** Characters to keep before the first match. */
  prefix?: number;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The whole query and its words of two or more characters, longest first. */
const getMatchTerms = (query: string): string[] => {
  const phrase = query.trim().toLowerCase();

  if (!phrase) return [];

  return [...new Set([phrase, ...phrase.split(/\s+/).filter((term) => term.length >= 2)])].sort(
    (a, b) => b.length - a.length
  );
};
const matchesQuery = (text: string, query: string): boolean => {
  return getMatchTerms(query).some((term) => text.toLowerCase().includes(term));
};
/** Splits text into parts that match the query and parts that do not, for highlighting. */
const splitMatches = (text: string, query: string): MatchPart[] => {
  const terms = getMatchTerms(query);

  if (!terms.length) return [{ text, match: false }];

  return text
    .split(new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "giu"))
    .filter(Boolean)
    .map((part) => ({ text: part, match: terms.includes(part.toLowerCase()) }));
};
/** Cuts the text to start just before the first match of the query. */
const getMatchPreview = (
  text: string,
  query: string,
  options: MatchPreviewOptions = {}
): string => {
  const lower = text.toLowerCase();
  const matches = getMatchTerms(query)
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);
  const start = matches.length ? Math.max(Math.min(...matches) - (options.prefix ?? 24), 0) : 0;
  const end = Math.min(start + (options.length ?? 180), text.length);

  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
};

export { getMatchTerms, matchesQuery, splitMatches, getMatchPreview };
export type { MatchPart, MatchPreviewOptions };
