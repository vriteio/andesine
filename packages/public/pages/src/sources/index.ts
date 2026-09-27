import type { PagesConfig } from "../config";
import { loadAndesineSource } from "./andesine/stored";
import { loadFilesSource } from "./files/load";
import type { SourceData } from "./types";

/** Loads the sources that render at build time, from their collections. */
const loadStaticSources = (config: PagesConfig): Promise<SourceData[]> => {
  return Promise.all(
    config.sources.flatMap((source) => {
      if (source.type === "files") {
        return [loadFilesSource(source, { base: config.base, site: config.site })];
      }

      if (source.rendering === "ssg") return [loadAndesineSource(source, config.base)];

      return [];
    })
  );
};

export { loadStaticSources };
export type * from "./types";
