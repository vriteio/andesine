import { mdxAdapter } from "@andesine/converters/mdx";
import { toLabel } from "../../output/markdown";
import type { SourceData, SourcePage } from "../types";

interface ParsedNode {
  type: string;
  name?: string | null;
  attributes?: ParsedAttribute[];
  children?: ParsedNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
}

interface ParsedAttribute {
  type: string;
  name?: string;
  value?: string | { value: string } | null;
}

/** Reads a string prop, written as `id="…"` or `id={"…"}`. */
const readAttribute = (node: ParsedNode, name: string): string | undefined => {
  const value = node.attributes?.find((attribute) => attribute.name === name)?.value;

  if (typeof value === "string") return value;

  try {
    const parsed: unknown = value ? JSON.parse(value.value) : undefined;

    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
};
const findOperationTags = (node: ParsedNode): ParsedNode[] => {
  const isTag = node.type.startsWith("mdxJsx") && node.name === "Operation";

  return isTag ? [node] : (node.children ?? []).flatMap(findOperationTags);
};
/** Parses the page as MDX, like its source, so code and other elements are never changed. */
const parseOperationTags = async (markdown: string): Promise<ParsedNode[]> => {
  if (!markdown.includes("<Operation")) return [];

  try {
    return findOperationTags((await mdxAdapter.parse(markdown)) as ParsedNode);
  } catch {
    // Pages that are not MDX, e.g. Markdown files, cannot render the component.
    return [];
  }
};
/**
 * Replaces `<Operation>` tags in Markdown alternatives with links to the operations' Markdown,
 * which agents can follow. Pages change in place, so navigation keeps pointing to them.
 */
const linkOperationTags = async (sources: SourceData[], site: string): Promise<SourceData[]> => {
  const operations = new Map<string, SourcePage>();
  const toLink = (tag: ParsedNode): string | undefined => {
    const target = operations.get(`${readAttribute(tag, "source")}:${readAttribute(tag, "id")}`);
    const operation = target?.content.type === "openapi" ? target.content.operation : undefined;

    if (!target || !operation) return undefined;

    const url = new URL(`${target.href}index.md`, site).href;

    return `[${toLabel(target.title)}](${url}): \`${operation.method.toUpperCase()} ${operation.path}\``;
  };

  sources.forEach((source) => {
    source.pages.forEach((page) => {
      if (page.content.type === "openapi" && page.content.operation) {
        operations.set(`${source.id}:${page.content.operation.id}`, page);
      }
    });
  });

  if (!operations.size) return sources;

  await Promise.all(
    sources
      .flatMap((source) => source.pages)
      .map(async (page) => {
        const tags = await parseOperationTags(page.markdown);

        // From the end, so the offsets of earlier tags stay valid.
        tags.reverse().forEach((tag) => {
          const start = tag.position?.start.offset;
          const end = tag.position?.end.offset;
          const link = toLink(tag);

          if (start === undefined || end === undefined || link === undefined) return;

          page.markdown = `${page.markdown.slice(0, start)}${link}${page.markdown.slice(end)}`;
        });
      })
  );

  return sources;
};

export { linkOperationTags };
