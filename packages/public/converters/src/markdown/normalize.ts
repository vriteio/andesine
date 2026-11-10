import type { Root, RootContent } from "mdast";

type MarkdownNode = Root | RootContent;
type FormattingNode = Extract<RootContent, { type: "strong" | "emphasis" | "delete" | "link" }>;

const isFormatting = (node: MarkdownNode): node is FormattingNode => {
  return ["strong", "emphasis", "delete", "link"].includes(node.type);
};
const sameFormatting = (first: FormattingNode, second: FormattingNode): boolean => {
  if (first.type !== second.type || JSON.stringify(first.data) !== JSON.stringify(second.data)) {
    return false;
  }

  return (
    first.type !== "link" ||
    (second.type === "link" && first.url === second.url && first.title === second.title)
  );
};
// Separate wrappers can produce ambiguous runs such as **first****second**.
// Join matching neighbors recursively, without changing caller-owned AST nodes.
const normalizeMarkdown = <T extends MarkdownNode>(node: T): T => {
  if (!("children" in node)) return node;

  const children: MarkdownNode[] = [];

  for (const child of node.children) {
    const previous = children[children.length - 1];

    if (
      previous &&
      isFormatting(previous) &&
      isFormatting(child) &&
      sameFormatting(previous, child)
    ) {
      previous.children.push(...child.children);
    } else {
      children.push(isFormatting(child) ? { ...child, children: [...child.children] } : child);
    }
  }

  return { ...node, children: children.map(normalizeMarkdown) } as T;
};

export { normalizeMarkdown };
