import type { PagesConfig } from "../config";
import { loadAndesineSource } from "./andesine/stored";
import { loadFilesSource } from "./files/load";
import { linkOperationTags } from "./openapi/links";
import { loadOpenAPISource } from "./openapi/stored";
import type { SourceData } from "./types";

/** Loads the sources from their collections. */
const loadStaticSources = async (config: PagesConfig): Promise<SourceData[]> => {
  const sources = await Promise.all(
    config.sources.flatMap((source) => {
      if (source.type === "files") {
        return [loadFilesSource(source, { base: config.base, site: config.site })];
      }

      if (source.type === "openapi") {
        return [loadOpenAPISource(source, { base: config.base, site: config.site })];
      }

      return [loadAndesineSource(source, config.base)];
    })
  );

  return linkOperationTags(sources, config.site);
};

export { loadStaticSources };
export type * from "./types";
