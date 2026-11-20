import { type AbstractType, type XmlFragment, XmlElement, XmlText } from "yjs";

interface TextSegment {
  text: XmlText;
  start: number;
  length: number;
  blockID: string | null;
}
interface TextPosition {
  segment: TextSegment;
  index: number;
}
/** Plain text; blocks and hard breaks become line breaks. */
interface LinearText {
  source: string;
  segments: TextSegment[];
  blocks: Map<string, { start: number; end: number }>;
}

// Embeds keep their index width, so string offsets match Y.js indexes.
const getPlainText = (text: XmlText): string => {
  return text
    .toDelta()
    .map(({ insert }: { insert: unknown }) => (typeof insert === "string" ? insert : "￼"))
    .join("");
};
const appendLinearText = (
  linear: LinearText,
  parent: XmlElement | XmlFragment,
  blockID: string | null
): void => {
  for (const node of parent.toArray()) {
    if (node instanceof XmlText) {
      const plain = getPlainText(node);

      linear.segments.push({
        text: node,
        start: linear.source.length,
        length: plain.length,
        blockID
      });
      linear.source += plain;
      continue;
    }

    if (!(node instanceof XmlElement)) continue;

    if (node.nodeName === "hardBreak") {
      linear.source += "\n";
      continue;
    }

    const ownID = node.getAttribute("id") as string | undefined;

    if (linear.source && !linear.source.endsWith("\n")) linear.source += "\n";

    const start = linear.source.length;

    appendLinearText(linear, node, ownID ?? blockID);

    if (ownID) linear.blocks.set(ownID, { start, end: linear.source.length });
  }
};
/** Shared by the API and the editor, so their offsets match. */
const getLinearText = (fragment: XmlFragment): LinearText => {
  const linear: LinearText = { source: "", segments: [], blocks: new Map() };

  appendLinearText(linear, fragment, null);

  return linear;
};
/** Null when the position isn't in text. */
const getLinearOffset = (
  linear: LinearText,
  type: AbstractType<unknown>,
  index: number
): number | null => {
  const segment = linear.segments.find(({ text }) => text === type);

  return segment ? segment.start + index : null;
};
/** Moves to the next text after a line break. */
const findStartPosition = (linear: LinearText, offset: number): TextPosition | null => {
  const segment = linear.segments.find(({ start, length }) => length && offset < start + length);

  return segment ? { segment, index: Math.max(offset - segment.start, 0) } : null;
};
/** Stays at the text before a line break. */
const findEndPosition = (linear: LinearText, offset: number): TextPosition | null => {
  const segment = [...linear.segments]
    .reverse()
    .find(({ start, length }) => length && start < offset);

  return segment ? { segment, index: Math.min(offset - segment.start, segment.length) } : null;
};

export { findEndPosition, findStartPosition, getLinearOffset, getLinearText, getPlainText };
export type { LinearText, TextPosition, TextSegment };
