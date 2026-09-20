import type { ContentNode } from "./types";

interface HeadingAnchor {
  path: readonly number[];
  text: string;
  anchor: string;
}

const getHeadingText = (node: ContentNode): string =>
  node.type === "hardBreak"
    ? " "
    : (node.text ?? (node.content || []).map(getHeadingText).join(""));
/**
 * Compute heading anchors that match Andesine search results and citations.
 * @param document - The full ProseMirror document. Titles and properties are excluded.
 * @returns Headings in document order with text, child-index path, and unique anchor.
 * Duplicate anchors receive numeric suffixes. Anchors are stable within a content version;
 * converting a fragment alone can produce different suffixes than converting the full document.
 */
const getHeadingAnchors = (document: ContentNode): HeadingAnchor[] => {
  const headings: HeadingAnchor[] = [];
  const used = new Set<string>();
  const visit = (node: ContentNode, path: number[]): void => {
    if (node.type === "title" || node.type === "property") return;

    if (node.type === "heading") {
      const text = getHeadingText(node).normalize("NFC").replace(/\s+/g, " ").trim();
      const base =
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
          .replace(/[\s_]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "") || "section";

      let anchor = base;
      let suffix = 1;

      while (used.has(anchor)) anchor = `${base}-${suffix++}`;

      used.add(anchor);
      headings.push({ path, text, anchor });
    }

    (node.content || []).forEach((child, index) => visit(child, [...path, index]));
  };

  visit(document, []);

  return headings;
};

export { getHeadingAnchors };
export type { HeadingAnchor };
