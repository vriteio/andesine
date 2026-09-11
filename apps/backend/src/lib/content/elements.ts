import {
  ELEMENT_BLOCKS,
  findDisallowedElementBlock,
  getElementData,
  normalizeElementAttributes
} from "@andesine/editor/element";
import type { ContentNode } from "./document";

const normalizeContentElements = (node: ContentNode): ContentNode => {
  const content = node.content?.map(normalizeContentElements);
  const attrs = node.type === "element" ? normalizeElementAttributes(node.attrs || {}) : node.attrs;

  if (node.type === "codeBlock") {
    if (
      content?.some(
        (child) =>
          child.type !== "text" ||
          typeof child.text !== "string" ||
          !child.text ||
          child.marks?.length ||
          child.content?.length
      )
    ) {
      throw new Error("Code blocks can only contain plain text");
    }
    if (attrs?.language != null && typeof attrs.language !== "string") {
      throw new Error("Code block language must be a string");
    }
  }

  if (node.type === "element") {
    const data = getElementData(attrs!);
    const invalid = findDisallowedElementBlock(content || [], ELEMENT_BLOCKS);

    if (data.selfClosing && content?.length) {
      throw new Error("Self-closing Elements cannot contain blocks");
    }
    if (content?.some((child) => !ELEMENT_BLOCKS.includes(child.type)) || invalid) {
      throw new Error("Elements can only contain regular editor blocks");
    }
  }
  if (node.type === "fragment" && Array.isArray(attrs?.allowedBlocks)) {
    const invalid = findDisallowedElementBlock(content || [], attrs.allowedBlocks);

    if (invalid) {
      throw new Error(`Fragment does not allow ${invalid} blocks`);
    }
  }

  return { ...node, ...(attrs ? { attrs } : {}), ...(content ? { content } : {}) };
};

export { normalizeContentElements };
