import type { Element, ElementContent, Root, RootContent } from "hast";
import type { FileTreeItem } from "./mdx-components";

const isElement = (node: RootContent | ElementContent): node is Element => node.type === "element";
const getText = (node: Root | RootContent): string => {
  if (node.type === "text") return node.value;

  return "children" in node ? node.children.map(getText).join("") : "";
};
/** Reads a `<ul>` of files and folders. Items that end with `/`, or have nested lists, are folders. */
const toFileTreeItems = (list: Element): FileTreeItem[] => {
  return list.children.filter(isElement).map((item) => {
    const nested = item.children.find(
      (child): child is Element => isElement(child) && child.tagName === "ul"
    );
    const name = item.children
      .filter((child) => child !== nested)
      .map(getText)
      .join("")
      .trim();
    const folder = name.endsWith("/") || Boolean(nested);

    return {
      name: name.replace(/\/$/, ""),
      type: folder ? "folder" : "file",
      children: nested ? toFileTreeItems(nested) : []
    };
  });
};

export { isElement, getText, toFileTreeItems };
