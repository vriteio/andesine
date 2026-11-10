import type { PublishedAnswerSource, PublishedSearchResult } from "@andesine/sdk";
import type { AnswerSource, SearchItem } from "./types";

/** Maps an entry to its page URL; entries without a page give `undefined`. */
type PageResolver = (result: Pick<PublishedSearchResult, "entryID">) => string | undefined;
type SearchResult = Pick<
  PublishedSearchResult,
  "entryID" | "anchor" | "title" | "snippet" | "headingPath"
>;
type CitedSource = Pick<
  PublishedAnswerSource,
  "id" | "entryID" | "anchor" | "title" | "headingPath" | "collectionPath"
>;

const toAnchorHash = (anchor?: string): string => (anchor ? `#${encodeURIComponent(anchor)}` : "");
/** Maps search results to page links; results without a page are left out. */
const toSearchItems = (results: SearchResult[], resolve: PageResolver): SearchItem[] => {
  return results.flatMap((result) => {
    const href = resolve(result);
    const hash = toAnchorHash(result.anchor);

    if (!href) return [];

    return [
      {
        id: `${result.entryID}${hash}`,
        href: `${href}${hash}`,
        title: result.title,
        excerpt: result.snippet,
        headingPath: result.headingPath
      }
    ];
  });
};
/** Maps the pages that an answer cites to page links; sources without a page are left out. */
const toAnswerSources = (sources: CitedSource[], resolve: PageResolver): AnswerSource[] => {
  return sources.flatMap((source) => {
    const href = resolve(source);

    if (!href) return [];

    return [
      {
        id: source.id,
        href: `${href}${toAnchorHash(source.anchor)}`,
        title: source.title,
        headingPath: source.headingPath,
        collectionPath: source.collectionPath
      }
    ];
  });
};

export { toAnchorHash, toSearchItems, toAnswerSources };
export type { PageResolver };
