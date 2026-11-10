import type { CustomRecord } from "pagefind";
import type { PagesConfig } from "../config";
import { filterVisibility } from "../content/visibility";
import { loadFilesSource } from "../sources/files/load";
import { loadOpenAPISource } from "../sources/openapi/stored";
import { toSearchText } from "./text";

/**
 * Creates Pagefind records for local pages from their source text, for the development index.
 * Built sites index the rendered pages instead.
 */
const getSearchRecords = async (config: PagesConfig): Promise<CustomRecord[]> => {
  const options = { base: config.base, site: config.site };
  const sources = await Promise.all(
    config.sources.flatMap((source) => {
      if (source.type === "files") return [loadFilesSource(source, options)];
      if (source.type === "openapi") return [loadOpenAPISource(source, options)];

      return [];
    })
  );

  return sources.flatMap((source) => {
    return source.pages.flatMap((page): CustomRecord[] => {
      // OpenAPI pages use their Markdown alternative, which has their fields.
      const text = page.content.type === "file" ? (page.content.entry.body ?? "") : page.markdown;
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
