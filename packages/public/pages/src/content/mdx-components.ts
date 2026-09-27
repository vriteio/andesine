interface MdastNode {
  type: string;
  name?: string | null;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  attributes?: MdxAttribute[];
  children?: MdastNode[];
}

interface FileTreeItem {
  name: string;
  type: "file" | "folder";
  children: FileTreeItem[];
}

interface MdxAttribute {
  type: string;
  name: string;
  value?: unknown;
}

interface VisitorContext {
  /** Swaps the node for the given nodes; an empty array removes it. */
  replaceNode(node: MdastNode, content: MdastNode[]): void;
}

/** Returns a node that replaces the visited node. */
type Handler = (node: MdastNode) => MdastNode;

const stringAttribute = (name: string, value: string): MdxAttribute => {
  return {
    type: "mdxJsxAttribute",
    name,
    value
  };
};
const getAttribute = (node: MdastNode, name: string): unknown => {
  return node.attributes?.find((attribute) => attribute.name === name)?.value;
};
/** Reads `title="..."` from a code fence meta string. */
const getCodeTitle = (meta?: string | null): string | undefined => {
  const match = meta?.match(/title=(?:"([^"]*)"|'([^']*)'|(\S+))/);

  return match?.[1] ?? match?.[2] ?? match?.[3];
};
const withValues = (node: MdastNode, labels: string[], children: MdastNode[]): MdastNode => {
  if (new Set(labels).size !== labels.length) {
    throw new Error(`<${node.name}> needs a unique label for each tab: ${labels.join(", ")}.`);
  }

  return {
    type: node.type,
    name: node.name,
    attributes: [
      ...(node.attributes ?? []).filter((attribute) => attribute.name !== "values"),
      stringAttribute("values", JSON.stringify(labels))
    ],
    children
  };
};
/** `<Tabs>` children `<Tab label="...">` become the named slots `tab-0`, `tab-1`, and so on. */
const prepareTabs: Handler = (node) => {
  const labels: string[] = [];
  const children = (node.children ?? []).map((child) => {
    if (child.type !== "mdxJsxFlowElement" || child.name !== "Tab") return child;

    const label = getAttribute(child, "label");
    const index = labels.length;

    if (typeof label !== "string" || !label.trim()) {
      throw new Error(`<Tab> ${index + 1} needs a text label, e.g. <Tab label="npm">.`);
    }

    labels.push(label);

    return {
      type: child.type,
      name: child.name,
      attributes: [...(child.attributes ?? []), stringAttribute("slot", `tab-${index}`)],
      children: child.children
    };
  });

  return withValues(node, labels, children);
};
/** `<CodeGroup>` code fences become tabs, labeled by their `title` or language. */
const prepareCodeGroup: Handler = (node) => {
  const blocks = (node.children ?? []).filter((child) => child.type === "code");
  const labels = blocks.map((block) => getCodeTitle(block.meta) ?? block.lang ?? "Code");
  const children = blocks.map((block, index) => {
    return {
      type: "mdxJsxFlowElement",
      name: "div",
      attributes: [stringAttribute("slot", `tab-${index}`)],
      children: [block]
    };
  });

  return withValues(node, labels, children);
};
/** Returns the text of a node, with inline code. */
const getText = (node: MdastNode): string => {
  return node.type === "text" || node.type === "inlineCode"
    ? (node.value ?? "")
    : (node.children ?? []).map(getText).join("");
};
const toFileTreeItems = (list: MdastNode): FileTreeItem[] => {
  return (list.children ?? []).map((item) => {
    const label = item.children?.find((child) => child.type !== "list");
    const nested = item.children?.find((child) => child.type === "list");
    const name = label ? getText(label).trim() : "";
    const folder = name.endsWith("/") || Boolean(nested);

    return {
      name: name.replace(/\/$/, ""),
      type: folder ? "folder" : "file",
      children: nested ? toFileTreeItems(nested) : []
    };
  });
};
/** `<FileTree>` gets its nested list as JSON `items`. Items that end with `/`, or have nested items, are folders. */
const prepareFileTree: Handler = (node) => {
  const list = node.children?.find((child) => child.type === "list");

  if (!list) throw new Error("<FileTree> needs a Markdown list of files and folders.");

  return {
    type: node.type,
    name: node.name,
    attributes: [stringAttribute("items", JSON.stringify(toFileTreeItems(list)))],
    children: []
  };
};
/** The web page shows only human content; agent content is in the Markdown outputs. */
const applyVisibility = (node: MdastNode, context: VisitorContext): void => {
  const audience = getAttribute(node, "for");

  if (audience !== "agents" && audience !== "humans") {
    throw new Error('<Visibility> needs for="agents" or for="humans".');
  }

  context.replaceNode(node, audience === "humans" ? (node.children ?? []) : []);
};
const handlers: Record<string, Handler> = {
  Tabs: prepareTabs,
  CodeGroup: prepareCodeGroup,
  FileTree: prepareFileTree
};

/**
 * Sätteri plugin that prepares the MDX components that need data from their children, and
 * applies `<Visibility>`.
 */
const mdxComponents = {
  name: "andesine-mdx-components",
  mdxJsxFlowElement(node: MdastNode, context: VisitorContext): MdastNode | void {
    if (node.name === "Visibility") return applyVisibility(node, context);
    if (node.name) return handlers[node.name]?.(node);
  }
};

export { mdxComponents, getCodeTitle };
export type { FileTreeItem };
