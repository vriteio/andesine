import type { PublishedTree } from "@andesine/sdk";
import type { AndesineSourceConfig } from "../../config";
import type { HighlightOptions } from "../../content/prepare";
import type { SourceData } from "../types";
import { deliveryAssets } from "./assets";
import {
  createAndesinePages,
  createAndesineSource,
  createHrefResolver,
  listTreeEntries
} from "./load";
import { readPublication } from "./read";

/**
 * Reads the latest publication for one request, or with `href`, only the tree and that page's
 * entry. Nothing is kept between requests, so a page never combines two publications.
 */
const loadLiveSource = async (
  source: AndesineSourceConfig,
  base: string,
  site: string,
  highlight: HighlightOptions,
  signal?: AbortSignal,
  href?: string
): Promise<SourceData> => {
  const selectPage = ({ collection }: PublishedTree): string | undefined => {
    const toPageHref = createHrefResolver(source, base, collection.slugPath);

    return listTreeEntries(collection).find(({ entry }) => toPageHref(entry.slugPath) === href)
      ?.entry.id;
  };
  const { tree, entries } = await readPublication(
    source,
    AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]),
    href === undefined ? undefined : selectPage
  );
  const pages = await createAndesinePages(source, tree.collection, entries, {
    base,
    site,
    assets: deliveryAssets,
    highlight
  });

  return createAndesineSource(source, tree.collection, base, pages);
};

export { loadLiveSource };
