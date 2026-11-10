import { unified, type Plugin } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGFM from "remark-gfm";
import type { Definition, PhrasingContent, Root, RootContent } from "mdast";
import { encodeMarkdown, encodeMarkdownMark } from "./encode";
import { decodeMarkdown, type MarkdownNode } from "./decode";
import { normalizeMarkdown } from "./normalize";
import { markdownStringifyOptions } from "./stringify";
import { ConversionError } from "../utils";
import type { FormatAdapter } from "../types";

const createMarkdownAdapter = (mdx?: Plugin): FormatAdapter<MarkdownNode> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGFM)
    .use(remarkStringify, markdownStringifyOptions);

  if (mdx) processor.use(mdx);

  const marks: Record<string, string> = {
    strong: "bold",
    emphasis: "italic",
    delete: "strike",
    inlineCode: "code",
    link: "link"
  };

  return {
    name: mdx ? "MDX" : "Markdown",
    frontmatter: true,
    type: (node) => node.type,
    markName: (node) => marks[node.type],
    root: (children) => ({
      type: "root",
      children: children.map((node) =>
        node.type === "image" ? { type: "paragraph", children: [node] } : node
      ) as RootContent[]
    }),
    parse(source) {
      const root = processor.parse(source);
      const definitions = new Map<string, Definition>();
      const collectDefinitions = (node: MarkdownNode): void => {
        if (node.type === "definition") {
          const identifier = node.identifier.toUpperCase();

          if (!definitions.has(identifier)) definitions.set(identifier, node);
        }

        if ("children" in node) node.children.forEach(collectDefinitions);
      };
      const resolve = (node: MarkdownNode): MarkdownNode => {
        if (node.type === "linkReference" || node.type === "imageReference") {
          const definition = definitions.get(node.identifier.toUpperCase());

          if (!definition)
            throw new ConversionError(`Missing Markdown definition: ${node.identifier}`);
          if (node.type === "imageReference")
            return { type: "image", url: definition.url, title: definition.title, alt: node.alt };

          return {
            type: "link",
            url: definition.url,
            title: definition.title,
            children: node.children.map(resolve) as PhrasingContent[]
          };
        }
        if ("children" in node)
          return { ...node, children: node.children.map(resolve) } as MarkdownNode;

        return node;
      };
      collectDefinitions(root);
      return resolve(root);
    },
    stringify: (root) => processor.stringify(normalizeMarkdown(root as Root)),
    encode: (node, context) =>
      encodeMarkdown(node, context as Parameters<typeof encodeMarkdown>[1]),
    mark: (mark, children, context) =>
      encodeMarkdownMark(
        mark,
        children as RootContent[],
        context as Parameters<typeof encodeMarkdownMark>[2]
      ),
    decode: decodeMarkdown
  };
};

export { createMarkdownAdapter };
