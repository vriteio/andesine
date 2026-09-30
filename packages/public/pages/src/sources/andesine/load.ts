import {
  toStructuredContent,
  type PublishedAsset,
  type PublishedCollection,
  type PublishedEntryContent
} from "@andesine/sdk";
import type { ContentNode } from "@andesine/converters";
import type { AndesineSourceConfig } from "../../config";
import { splitFragments } from "../../content/fragments";
import { toPageMarkdown } from "../../content/markdown";
import { prepareContent, type HighlightOptions } from "../../content/prepare";
import { toHref, toSegments } from "../../routing";
import type { SourceData, SourceNode, SourcePage } from "../types";
import type { AssetStore } from "./assets";

interface EntryMetadata {
  description?: string;
  searchHidden: boolean;
  toc: boolean;
  layout: "docs" | "wide";
}

interface LoadOptions {
  base: string;
  /** The site URL, for absolute links in Markdown alternatives. */
  site: string;
  assets: AssetStore;
  highlight: HighlightOptions;
}

interface TreeEntry {
  entry: PublishedCollection["entries"][number];
  collection: PublishedCollection;
}

type HrefResolver = (slugPath: string) => string;

const isIndex = (slugPath: string): boolean => slugPath.endsWith("/index");
/** Reads the standard documentation properties. Missing properties use their defaults. */
const readMetadata = (entry: PublishedEntryContent): EntryMetadata => {
  const properties = toStructuredContent(entry).properties as Record<string, unknown>;
  const text = (key: string): string | undefined => {
    const value = properties[key];

    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };
  const flag = (key: string, fallback: boolean): boolean => {
    const value = properties[key];

    return typeof value === "boolean" ? value : fallback;
  };

  return {
    description: text("description"),
    searchHidden: flag("searchHidden", false),
    toc: flag("toc", true),
    layout: text("layout") === "wide" ? "wide" : "docs"
  };
};
/**
 * Returns the site URL of a published slug path, relative to the source's root collection. An
 * `index` entry has its collection's URL, like an `index` file.
 */
const createHrefResolver = (
  source: AndesineSourceConfig,
  base: string,
  rootSlugPath: string
): HrefResolver => {
  const label = `Source "${source.id}"`;
  const prefix = [...toSegments(base, "Site base"), ...toSegments(source.mount, `${label} mount`)];
  const root = toSegments(rootSlugPath, `${label} root`);

  return (slugPath) => {
    const segments = toSegments(slugPath, label).slice(root.length);

    return toHref(prefix, isIndex(slugPath) ? segments.slice(0, -1) : segments);
  };
};
/** Lists the entries of a collection and its descendants, with their collections. */
const listTreeEntries = (collection: PublishedCollection): TreeEntry[] => {
  return [
    ...collection.entries.map((entry) => ({ entry, collection })),
    ...collection.collections.flatMap(listTreeEntries)
  ];
};
/** An `index` entry takes its collection's name, so its page is not titled "Index". */
const getTitle = ({ entry, collection }: TreeEntry): string => {
  return isIndex(entry.slugPath) ? collection.name : entry.name;
};
/** Prepares the content of published entries as pages. */
const createAndesinePages = async (
  source: AndesineSourceConfig,
  tree: PublishedCollection,
  entries: PublishedEntryContent[],
  options: LoadOptions
): Promise<SourcePage[]> => {
  const label = `Source "${source.id}"`;
  const toPageHref = createHrefResolver(source, options.base, tree.slugPath);
  const treeEntries = new Map(listTreeEntries(tree).map((item) => [item.entry.id, item]));
  // Content links use the name or slug paths of published entries.
  const links = new Map(
    [...treeEntries.values()].flatMap(({ entry }) => {
      const href = toPageHref(entry.slugPath);

      return [
        [entry.path, href],
        [entry.slugPath, href]
      ];
    })
  );
  const linkURL = (href: string): string => {
    const [, path = "", suffix = ""] = /^([^?#]*)(.*)$/s.exec(href) ?? [];

    return links.has(path) ? `${links.get(path)}${suffix}` : href;
  };

  return Promise.all(
    entries.map(async (entry): Promise<SourcePage> => {
      const data = readMetadata(entry);
      const treeEntry = treeEntries.get(entry.id);
      const findAsset = (assetID: unknown): PublishedAsset => {
        const asset = entry.assets.find(
          (item) => item.assetID === assetID && item.variant === "display"
        );

        if (!asset) throw new Error(`${label}, entry ${entry.id}: image ${assetID} is missing.`);

        return asset;
      };
      const href = toPageHref(entry.slugPath);
      const pageURL = new URL(href, options.site);
      const fragments = splitFragments(entry);
      const imageURL = async (image: ContentNode): Promise<string> => {
        return options.assets.resolve(findAsset(image.attrs?.assetID), entry.id);
      };
      const prepare = (document?: ContentNode) => {
        return (
          document && prepareContent(document, { imageURL, linkURL, highlight: options.highlight })
        );
      };
      const [[body, summary, aside], markdown] = await Promise.all([
        Promise.all([
          prepare(fragments.body)!,
          prepare(fragments.summary),
          prepare(fragments.aside)
        ]),
        toPageMarkdown(
          [fragments.summary, fragments.body, fragments.aside].filter((item) => item !== undefined),
          {
            imageURL: async (image) => new URL(await imageURL(image), pageURL).href,
            linkURL: (link) => new URL(linkURL(link), pageURL).href
          }
        )
      ]).catch((error: Error) => {
        throw new Error(`${label}, entry ${entry.id}: ${error.message}`);
      });

      return {
        sourceID: source.id,
        id: entry.id,
        href,
        title: treeEntry ? getTitle(treeEntry) : entry.name,
        description: data.description,
        toc: data.toc,
        layout: data.layout,
        searchHidden: data.searchHidden,
        markdown,
        updatedAt: entry.version.createdAt,
        content: {
          type: "andesine",
          ...body,
          iconCSS: [body, summary, aside].map((item) => item?.iconCSS ?? "").join(""),
          summary: summary?.nodes,
          aside: aside?.nodes
        }
      };
    })
  );
};
/**
 * Maps a publication tree to navigation, like the app's explorer: collections first, then
 * entries. The pages come from the same snapshot as the tree, so each entry has one.
 */
const createAndesineSource = (
  source: AndesineSourceConfig,
  tree: PublishedCollection,
  base: string,
  prepared: SourcePage[]
): SourceData => {
  const toPageHref = createHrefResolver(source, base, tree.slugPath);
  // Copies, so changes to a page, e.g. operation links, never change the stored publication.
  const pagesByID = new Map(prepared.map((page) => [page.id, { ...page }]));
  const pages = listTreeEntries(tree).map((item) => pagesByID.get(item.entry.id)!);
  const toNode = (page: SourcePage): SourceNode => {
    return { id: `${source.id}:${page.id}`, label: page.title, page };
  };
  // Published entries are in ascending rank; the explorer shows them in descending rank.
  const build = (collection: PublishedCollection): SourceNode[] => {
    const groups = collection.collections.flatMap((child): SourceNode[] => {
      const landing = child.entries.find((entry) => isIndex(entry.slugPath));
      const children = build(child);
      const node: SourceNode = {
        id: `${source.id}:${child.id}`,
        label: child.name,
        page: landing && pagesByID.get(landing.id),
        children
      };

      return node.page || children.length ? [node] : [];
    });
    // The root's index page is a normal page; other index pages belong to their group.
    const isRoot = collection === tree;
    const leaves = [...collection.entries]
      .reverse()
      .filter((entry) => isRoot || !isIndex(entry.slugPath))
      .map((entry) => toNode(pagesByID.get(entry.id)!));

    return [...groups, ...leaves];
  };

  return {
    id: source.id,
    href: toPageHref(tree.slugPath),
    pages,
    navigation: build(tree)
  };
};

export { createAndesineSource, createAndesinePages };
export type { LoadOptions };
