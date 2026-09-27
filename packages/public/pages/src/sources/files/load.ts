import { getCollection } from "astro:content";
import type { FilesSourceConfig } from "../../config";
import { toFileMarkdown } from "../../content/markdown";
import { toHref, toSegments } from "../../routing/paths";
import type { FileEntry, SourceData, SourceNode, SourcePage } from "../types";
import type { FileMetadata } from "./schema";

interface TreeNode extends SourceNode {
  path: string;
  order: number;
  children?: TreeNode[];
}

interface FilesSourceOptions {
  base: string;
  /** The site URL, for absolute links in Markdown alternatives. */
  site: string;
}

const toLabel = (name: string): string => {
  return name.replace(/[-_]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
};
const toMarkdown = (entry: FileEntry, label: string, pageURL: URL): string => {
  try {
    return toFileMarkdown(entry.body, pageURL);
  } catch (error) {
    throw new Error(`${label}: ${(error as Error).message}`);
  }
};
const sortTree = (nodes: TreeNode[]): SourceNode[] => {
  return [...nodes]
    .sort((a, b) => a.order - b.order || a.path.localeCompare(b.path, "en"))
    .map(({ id, label, page, children }) => {
      return {
        id,
        label,
        page,
        children: children && sortTree(children)
      };
    })
    .filter((node) => node.page || node.children?.length);
};
const createFilesSource = (
  source: FilesSourceConfig,
  options: FilesSourceOptions,
  entries: FileEntry[]
): SourceData => {
  const { base } = options;
  const prefix = [
    ...toSegments(base, "Site base"),
    ...toSegments(source.mount, `Source "${source.id}" mount`)
  ];
  const root: TreeNode[] = [];
  const folders = new Map<string, TreeNode>();
  const pages: SourcePage[] = [];
  const getFolder = (segments: string[]): TreeNode[] => {
    if (!segments.length) return root;

    const path = segments.join("/");
    const existing = folders.get(path);

    if (existing) return existing.children!;

    const folder: TreeNode = {
      id: `${source.id}:${path}/`,
      label: toLabel(segments.at(-1)!),
      path,
      order: 0,
      children: []
    };

    folders.set(path, folder);
    getFolder(segments.slice(0, -1)).push(folder);

    return folder.children!;
  };

  for (const entry of entries) {
    const data = entry.data as FileMetadata;
    const label = `Source "${source.id}", file "${entry.id}"`;
    const path = entry.id.replace(/\.mdx?$/, "");
    const segments = toSegments(path, label);
    const folderSegments = segments.slice(0, -1);
    const isIndex = segments.at(-1) === "index";
    const route =
      data.slug === undefined
        ? isIndex
          ? folderSegments
          : segments
        : toSegments(data.slug, `${label}, slug`);
    const href = toHref(prefix, route);
    const page: SourcePage = {
      sourceID: source.id,
      id: entry.id,
      href,
      title: data.title,
      description: data.description,
      toc: data.toc,
      layout: data.layout,
      searchHidden: data.searchHidden,
      markdown: toMarkdown(entry, label, new URL(href, options.site)),
      updatedAt: data.updatedAt?.toISOString(),
      content: { type: "file", entry }
    };
    const node: TreeNode = {
      id: `${source.id}:${entry.id}`,
      label: data.navigationLabel ?? data.title,
      path,
      order: data.order,
      page: data.navigationHidden ? undefined : page
    };

    pages.push(page);

    // A folder's index page is the landing page of its group.
    if (isIndex && folderSegments.length) {
      getFolder(folderSegments);
      Object.assign(folders.get(folderSegments.join("/"))!, {
        label: node.label,
        order: node.order,
        page: node.page
      });
    } else {
      getFolder(folderSegments).push(node);
    }
  }

  return { id: source.id, href: toHref(prefix), pages, navigation: sortTree(root) };
};
const loadFilesSource = async (
  source: FilesSourceConfig,
  options: FilesSourceOptions
): Promise<SourceData> => {
  const entries = (await getCollection(source.id)) as FileEntry[];

  return createFilesSource(source, options, entries);
};

export { createFilesSource, loadFilesSource };
