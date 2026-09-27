import type { Root } from "hast";
import type { HeadingContext } from "../context";

interface FileEntry {
  id: string;
  data: Record<string, unknown>;
  /** Raw Markdown or MDX source. */
  body?: string;
}

interface FileContent {
  type: "file";
  /** Astro collection entry, rendered with `render()`. */
  entry: FileEntry;
}

interface AndesineContent {
  type: "andesine";
  /** HTML syntax tree, rendered with the template's content components. */
  nodes: Root;
  headings: HeadingContext[];
  iconCSS: string;
  /** Introduction content, before the body. */
  summary?: Root;
  /** Supporting content, after the body. */
  aside?: Root;
}

interface SourcePage {
  sourceID: string;
  id: string;
  /** Base-prefixed, encoded URL path with a trailing slash. */
  href: string;
  title: string;
  description?: string;
  toc: boolean;
  layout: "docs" | "wide";
  /** Leaves the page out of search. Search results are not access control. */
  searchHidden: boolean;
  /** The page's Markdown alternative, without the title and description. */
  markdown: string;
  /** ISO date of the last content change, when known. */
  updatedAt?: string;
  content: FileContent | AndesineContent;
}

interface SourceNode {
  id: string;
  label: string;
  /** The page of a leaf, or the landing page of a group. */
  page?: SourcePage;
  /** Present for groups only. */
  children?: SourceNode[];
}

interface SourceData {
  id: string;
  /** Base-prefixed URL path of the source mount. */
  href: string;
  /** All pages, including pages that are hidden from navigation. */
  pages: SourcePage[];
  navigation: SourceNode[];
}

export type { FileEntry, FileContent, AndesineContent, SourcePage, SourceNode, SourceData };
