import type {
  RootContent,
  PhrasingContent,
  BlockContent,
  ListContent,
  TableContent,
  RowContent
} from "mdast";
import { ConversionError, textContent } from "../utils";
import type { ContentMark, ContentNode, EncodeContext } from "../types";

const encodeMarkdown = async (
  node: ContentNode,
  context: EncodeContext<RootContent>
): Promise<RootContent> => {
  const attrs = node.attrs || {};
  const children = await context.children(node);

  switch (node.type) {
    case "text":
      return { type: "text", value: node.text || "" };
    case "paragraph":
      return { type: "paragraph", children: children as PhrasingContent[] };
    case "heading":
      return {
        type: "heading",
        ...(context.anchor ? { data: { hProperties: { id: context.anchor } } } : {}),
        depth: Number(attrs.level || 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: children as PhrasingContent[]
      };
    case "blockquote":
      return { type: "blockquote", children: children as BlockContent[] };
    case "bulletList":
    case "orderedList":
    case "taskList":
      return {
        type: "list",
        ordered: node.type === "orderedList",
        ...(node.type === "orderedList" ? { start: Number(attrs.start || 1) } : {}),
        spread: false,
        children: children as ListContent[]
      };
    case "listItem":
    case "taskItem":
      return {
        type: "listItem",
        ...(node.type === "taskItem" ? { checked: Boolean(attrs.checked) } : {}),
        spread: false,
        children: children as BlockContent[]
      };
    case "hardBreak":
      return { type: "break" };
    case "horizontalRule":
      return { type: "thematicBreak" };
    case "codeBlock":
      return {
        type: "code",
        lang: typeof attrs.language === "string" ? attrs.language : null,
        value: textContent(node)
      };
    case "image":
      return {
        type: "image",
        url: await context.imageURL(node),
        alt: String(attrs.alt || ""),
        title: attrs.caption ? String(attrs.caption) : null
      };
    case "table":
      return { type: "table", children: children as TableContent[] };
    case "tableRow":
      return { type: "tableRow", children: children as RowContent[] };
    case "tableCell":
    case "tableHeader": {
      if (
        Number(attrs.colspan || 1) !== 1 ||
        Number(attrs.rowspan || 1) !== 1 ||
        children.some((child) => child.type !== "paragraph") ||
        children.length > 1
      ) {
        throw new ConversionError(
          "Markdown tables require single-paragraph cells without spans",
          context.path
        );
      }
      return {
        type: "tableCell",
        children: children.flatMap((child) => (child.type === "paragraph" ? child.children : []))
      };
    }
    default:
      throw new ConversionError(`Unsupported Markdown node: ${node.type}`, context.path);
  }
};
const encodeMarkdownMark = (
  mark: ContentMark,
  children: RootContent[],
  context: EncodeContext<RootContent>
): RootContent => {
  const content = children as PhrasingContent[];

  switch (mark.type) {
    case "bold":
      return { type: "strong", children: content };
    case "italic":
      return { type: "emphasis", children: content };
    case "strike":
      return { type: "delete", children: content };
    case "link":
      return { type: "link", url: String(mark.attrs?.href || ""), title: null, children: content };
    case "code": {
      if (children.some((node) => node.type !== "text"))
        throw new ConversionError("Code marks must wrap plain text", context.path);

      return {
        type: "inlineCode",
        value: children.map((node) => (node.type === "text" ? node.value : "")).join("")
      };
    }
    default:
      throw new ConversionError(`Unsupported Markdown mark: ${mark.type}`, context.path);
  }
};

export { encodeMarkdown, encodeMarkdownMark };
