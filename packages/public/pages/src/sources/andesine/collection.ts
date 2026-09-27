import { defineCollection } from "astro/content/config";
import type { AndesineSourceConfig } from "../../config";
import type { HighlightOptions } from "../../content/prepare";
import { createAssetCache } from "./asset-cache";
import { createAndesinePages } from "./load";
import { readPublication } from "./read";
import { recordID, type StoredSource } from "./stored";

/** Reads the latest publication at build time, and copies its images into the build. */
const createAndesineCollection = (
  source: AndesineSourceConfig,
  base: string,
  site: string,
  highlight: HighlightOptions
) => {
  return defineCollection({
    loader: {
      name: `andesine-${source.id}`,
      load: async ({ store, config, logger }) => {
        const assets = createAssetCache(new URL(`andesine/${source.id}/`, config.cacheDir), base);
        const { tree, entries } = await readPublication(source);
        const pages = await createAndesinePages(source, tree.collection, entries, {
          base,
          site,
          assets,
          highlight
        });
        const stored: StoredSource = { tree: tree.collection, pages };

        await assets.finish();
        store.clear();
        store.set({ id: recordID, data: stored as never });
        logger.info(`Source "${source.id}": loaded ${pages.length} published pages.`);
      }
    }
  });
};

export { createAndesineCollection };
