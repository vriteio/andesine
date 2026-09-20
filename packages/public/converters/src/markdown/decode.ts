import type { Root, RootContent } from "mdast";
import { ConversionError, textNode, withMark } from "../utils";
import type { ContentNode, DecodeContext } from "../types";

type MarkdownNode = Root | RootContent;

const paragraphContent = (children: ContentNode[]): ContentNode[] => {
  const blocks: ContentNode[] = [];
  let inline: ContentNode[] = [];

  for (const child of children) {
    if (["text", "hardBreak"].includes(child.type)) {
      inline.push(child);
    } else {
      if (inline.length) blocks.push({ type: "paragraph", content: inline });
      inline = [];
      blocks.push(child);
    }
  }
  if (inline.length || !blocks.length) blocks.push({ type: "paragraph", content: inline });

  return blocks;
};
const decodeMarkdown = async (
  node: MarkdownNode,
  context: DecodeContext<MarkdownNode>
): Promise<ContentNode | ContentNode[] | null> => {
  const children = "children" in node ? await context.children(node.children) : [];

  switch (node.type) {
    case "root":
      return children;
    case "text":
      return textNode(node.value);
    case "paragraph":
      return paragraphContent(children);
    case "heading":
      return { type: "heading", attrs: { level: node.depth }, content: children };
    case "blockquote":
      return { type: "blockquote", content: children };
    case "list": {
      const tasks = children.some((child) => child.type === "taskItem");

      if (node.ordered && tasks)
        throw new ConversionError("Ordered task lists require a custom handler", context.path);

      return {
        type: node.ordered ? "orderedList" : tasks ? "taskList" : "bulletList",
        ...(node.ordered ? { attrs: { start: node.start || 1 } } : {}),
        content: tasks
          ? children.map((child) => ({
              ...child,
              type: "taskItem",
              attrs: { checked: false, ...child.attrs }
            }))
          : children
      };
    }
    case "listItem":
      return {
        type: typeof node.checked === "boolean" ? "taskItem" : "listItem",
        ...(typeof node.checked === "boolean" ? { attrs: { checked: node.checked } } : {}),
        content: children
      };
    case "break":
      return { type: "hardBreak" };
    case "thematicBreak":
      return { type: "horizontalRule" };
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: node.lang || null },
        content: textNode(node.value)
      };
    case "inlineCode":
      return withMark(textNode(node.value), { type: "code" });
    case "strong":
      return withMark(children, { type: "bold" });
    case "emphasis":
      return withMark(children, { type: "italic" });
    case "delete":
      return withMark(children, { type: "strike" });
    case "link":
      return withMark(children, { type: "link", attrs: { href: node.url } });
    case "image":
      return context.image({ url: node.url, alt: node.alt || "", title: node.title || undefined });
    case "table":
      return {
        type: "table",
        content: children.map((row, index) =>
          index
            ? row
            : { ...row, content: row.content?.map((cell) => ({ ...cell, type: "tableHeader" })) }
        )
      };
    case "tableRow":
      return { type: "tableRow", content: children };
    case "tableCell":
      return { type: "tableCell", content: paragraphContent(children) };
    case "definition":
      return null;
    default:
      throw new ConversionError(`Unsupported Markdown syntax: ${node.type}`, context.path);
  }
};

export { decodeMarkdown, paragraphContent };
export type { MarkdownNode };
