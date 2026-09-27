import type { PublishedCollection } from "@andesine/sdk";
import { getCollection } from "astro:content";
import type { AndesineSourceConfig } from "../../config";
import type { SourceData, SourcePage } from "../types";
import { createAndesineSource } from "./load";

interface StoredSource {
  tree: PublishedCollection;
  pages: SourcePage[];
}

const recordID = "source";

/** Reads a publication that the build loaded. */
const loadAndesineSource = async (
  source: AndesineSourceConfig,
  base: string
): Promise<SourceData> => {
  const [record] = await getCollection(source.id);
  const stored = record?.data as StoredSource | undefined;

  if (!stored) throw new Error(`Source "${source.id}": the build did not load the publication.`);

  return createAndesineSource(source, stored.tree, base, stored.pages);
};

export { recordID, loadAndesineSource };
export type { StoredSource };
