import type { Element, ElementContent, Root, RootContent } from "hast";

const isElement = (node: RootContent | ElementContent): node is Element => node.type === "element";
const getText = (node: Root | RootContent): string => {
  if (node.type === "text") return node.value;

  return "children" in node ? node.children.map(getText).join("") : "";
};
export { isElement, getText };
