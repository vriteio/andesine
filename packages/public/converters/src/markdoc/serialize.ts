import Markdoc from "@markdoc/markdoc";
import { unified } from "unified";
import remarkStringify from "remark-stringify";
import remarkGFM from "remark-gfm";
import type {
  Root,
  RootContent,
  PhrasingContent,
  BlockContent,
  ListContent,
  TableContent,
  RowContent
} from "mdast";
import { ConversionError } from "../utils";
import { normalizeMarkdown } from "../markdown/normalize";
import { markdownStringifyOptions } from "../markdown/stringify";

type MarkdocNode = InstanceType<typeof Markdoc.Ast.Node>;
type MarkdownNode = Root | RootContent;

// Markdoc's formatter preserves source-like text. Use a Markdown serializer to
// escape literal Markdown characters in newly created content.
const processor = unified()
  .use(remarkGFM)
  .use(remarkStringify, {
    ...markdownStringifyOptions,
    unsafe: [{ character: "{", after: "%" }]
  });
const serializeMarkdoc = (tree: MarkdocNode): string => {
  const convert = (node: MarkdocNode): MarkdownNode[] => {
    const attrs = node.attributes;
    const children = node.children.flatMap(convert);
    const inline = children as PhrasingContent[];

    switch (node.type) {
      case "document":
        return [{ type: "root", children: children as RootContent[] }];
      case "inline":
      case "thead":
      case "tbody":
        return children;
      case "text":
        return [{ type: "text", value: String(attrs.content || "") }];
      case "paragraph":
        return [{ type: "paragraph", children: inline }];
      case "heading":
        return [
          {
            type: "heading",
            depth: Number(attrs.level || 1) as 1 | 2 | 3 | 4 | 5 | 6,
            children: inline
          }
        ];
      case "strong":
        return [{ type: "strong", children: inline }];
      case "em":
        return [{ type: "emphasis", children: inline }];
      case "s":
        return [{ type: "delete", children: inline }];
      case "code":
        return [{ type: "inlineCode", value: String(attrs.content || "") }];
      case "link":
        return [{ type: "link", url: String(attrs.href || ""), children: inline }];
      case "image":
        return [
          {
            type: "image",
            url: String(attrs.src || ""),
            alt: String(attrs.alt || ""),
            title: attrs.title || null
          }
        ];
      case "blockquote":
        return [{ type: "blockquote", children: children as BlockContent[] }];
      case "list":
        return [
          {
            type: "list",
            ordered: Boolean(attrs.ordered),
            start: Number(attrs.start || 1),
            children: children as ListContent[]
          }
        ];
      case "item":
        return [{ type: "listItem", children: children as BlockContent[] }];
      case "fence":
        return [
          { type: "code", lang: String(attrs.language || ""), value: String(attrs.content || "") }
        ];
      case "hardbreak":
        return [{ type: "break" }];
      case "softbreak":
        return [{ type: "text", value: "\n" }];
      case "hr":
        return [{ type: "thematicBreak" }];
      case "table":
        return [{ type: "table", children: children as TableContent[] }];
      case "tr":
        return [{ type: "tableRow", children: children as RowContent[] }];
      case "td":
      case "th":
        return [{ type: "tableCell", children: inline }];
      case "tag": {
        const opening = Markdoc.format(new Markdoc.Ast.Node("tag", attrs, [], node.tag)).trim();
        const body = processor.stringify(
          normalizeMarkdown({ type: "root", children: children as RootContent[] })
        );
        const value = children.length
          ? `${opening.replace(/\s*\/%\}$/, " %}")}\n\n${body}\n{% /${node.tag} %}`
          : opening;

        return [{ type: "html", value }];
      }
      default:
        throw new ConversionError(`Unsupported Markdoc AST node: ${node.type}`);
    }
  };
  const nodes = convert(tree);
  const root: Root =
    nodes[0]?.type === "root" ? nodes[0] : { type: "root", children: nodes as RootContent[] };

  return processor.stringify(normalizeMarkdown(root));
};

export { serializeMarkdoc };
