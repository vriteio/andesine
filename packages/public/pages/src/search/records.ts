import type { CustomRecord } from "pagefind";
import type { PagesConfig } from "../config";
import { filterVisibility } from "../content/visibility";
import { loadFilesSource } from "../sources/files/load";
import { toSearchText } from "./text";

/**
 * Creates Pagefind records for local pages from their source text, for the development index.
 * Built sites index the rendered pages instead.
 */
const getSearchRecords = async (config: PagesConfig): Promise<CustomRecord[]> => {
  const sources = await Promise.all(
    config.sources.flatMap((source) => {
      return source.type === "files"
        ? [loadFilesSource(source, { base: config.base, site: config.site })]
        : [];
    })
  );

  return sources.flatMap((source) => {
    return source.pages.flatMap((page): CustomRecord[] => {
      const text = page.content.type === "file" ? (page.content.entry.body ?? "") : "";
      // Like the built index, which reads the rendered page.
      const body = toSearchText(filterVisibility(text, "humans"));

      if (page.searchHidden) return [];

      return [
        {
          // Relative to the base, which the client sets as the Pagefind base URL.
          url: page.href.slice(config.base.length - 1),
          content: [page.title, page.description, body].filter(Boolean).join("\n"),
          language: config.language,
          meta: { title: page.title },
          filters: { source: [source.id] }
        }
      ];
    });
  });
};

export { getSearchRecords };
