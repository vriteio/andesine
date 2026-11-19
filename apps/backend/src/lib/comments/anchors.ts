import { type CommentAnchor, type CommentAnchorStatus } from "@andesine/contracts/entities";
import { ORPCError } from "@orpc/server";
import {
  createAbsolutePositionFromRelativePosition,
  createRelativePositionFromTypeIndex,
  decodeRelativePosition,
  type Doc,
  encodeRelativePosition,
  type XmlFragment,
  XmlElement,
  XmlText
} from "yjs";

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
interface QuotePositions {
  start: TextPosition;
  end: TextPosition;
}
/** Plain text of a document as readers see it: blocks and hard breaks become line breaks. */
interface LinearText {
  source: string;
  segments: TextSegment[];
  blocks: Map<string, { start: number; end: number }>;
}
interface AnchorState {
  status: CommentAnchorStatus;
  text: string | null;
  /** New anchor of an orphaned quote that was found again; store it. */
  anchor?: CommentAnchor;
}
interface CreateAnchorInput {
  blockID: string | null;
  quote?: string;
  offset?: number;
  /** Requires the quote to be in one run of text, so a suggestion can replace it. */
  singleText?: boolean;
}
interface CreatedAnchor {
  anchor: CommentAnchor | null;
  blockID: string | null;
}
interface ThreadAnchorInput {
  blockID: string | null;
  anchor: CommentAnchor | null;
  quote: string | null;
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
// Deleted types are skipped by toArray(), so their positions don't resolve.
const getLinearText = (document: Doc): LinearText => {
  const linear: LinearText = { source: "", segments: [], blocks: new Map() };

  appendLinearText(linear, document.getXmlFragment("default"), null);

  return linear;
};
/** Position of the character at the offset, or of the next text after a line break. */
const findStartPosition = (linear: LinearText, offset: number): TextPosition | null => {
  const segment = linear.segments.find(({ start, length }) => length && offset < start + length);

  return segment ? { segment, index: Math.max(offset - segment.start, 0) } : null;
};
/** Position after the character before the offset, or after the text before a line break. */
const findEndPosition = (linear: LinearText, offset: number): TextPosition | null => {
  const segment = [...linear.segments]
    .reverse()
    .find(({ start, length }) => length && start < offset);

  return segment ? { segment, index: Math.min(offset - segment.start, segment.length) } : null;
};
const encodePosition = ({ segment, index }: TextPosition, assoc: number): string => {
  return Buffer.from(
    encodeRelativePosition(createRelativePositionFromTypeIndex(segment.text, index, assoc))
  ).toString("base64");
};
/** Offsets of a quote in the text of an existing block, or of the document without one. */
const findQuoteOffsets = (linear: LinearText, blockID: string | null, quote: string) => {
  const block = blockID ? linear.blocks.get(blockID) : undefined;
  const scopeStart = block?.start ?? 0;
  const scope = linear.source.slice(scopeStart, block?.end);
  const offsets: number[] = [];

  for (let index = scope.indexOf(quote); index >= 0; index = scope.indexOf(quote, index + 1)) {
    offsets.push(scopeStart + index);
  }

  return { scope, scopeStart, offsets };
};
/** Positions of a quote's text, or null when it has none. */
const findQuotePositions = (
  linear: LinearText,
  offset: number,
  length: number
): QuotePositions | null => {
  const start = findStartPosition(linear, offset);
  const end = findEndPosition(linear, offset + length);
  const hasText = start && end && end.segment.start + end.index > start.segment.start + start.index;

  return hasText ? { start, end } : null;
};
// The end sticks to the last quoted character, so text typed after stays out.
const encodeAnchor = ({ start, end }: QuotePositions): CommentAnchor => {
  return { start: encodePosition(start, 0), end: encodePosition(end, -1) };
};
/** Anchors the only occurrence of a quote in its block, or in the document without one. */
const findSingleQuote = (
  linear: LinearText,
  blockID: string | null,
  quote: string
): CommentAnchor | null => {
  if (blockID && !linear.blocks.has(blockID)) return null;

  const { offsets } = findQuoteOffsets(linear, blockID, quote);
  const positions =
    offsets.length === 1 ? findQuotePositions(linear, offsets[0], quote.length) : null;

  return positions && encodeAnchor(positions);
};
const createAnchor = (document: Doc, input: CreateAnchorInput): CreatedAnchor => {
  const { blockID, quote, offset } = input;
  const linear = getLinearText(document);

  if (blockID && !linear.blocks.has(blockID)) {
    throw new ORPCError("BAD_REQUEST", { message: `Block ${blockID} not found` });
  }

  if (!quote) return { anchor: null, blockID };

  const found = findQuoteOffsets(linear, blockID, quote);
  const { scope, scopeStart } = found;
  const offsets = offset === undefined ? found.offsets : [scopeStart + offset];
  const isOffsetWrong = offset !== undefined && !scope.startsWith(quote, offset);

  if (isOffsetWrong) {
    throw new ORPCError("BAD_REQUEST", { message: `Quote not found at offset ${offset}` });
  }

  if (!offsets.length) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Quote not found",
      data: {
        hints: ["Use plain text as readers see it, without MDX markup; separate blocks with \\n"]
      }
    });
  }

  if (offsets.length > 1) {
    const blockIDs = new Set(
      offsets.map((match) => findStartPosition(linear, match)?.segment.blockID)
    );

    throw new ORPCError("BAD_REQUEST", {
      message: `Quote found ${offsets.length} times`,
      data: {
        hints: [
          blockIDs.size > 1 && !blockID
            ? `Add the blockID of one of the blocks: ${[...blockIDs].filter(Boolean).join(", ")}`
            : "Quote more text or add the offset, so it matches once"
        ]
      }
    });
  }

  const positions = findQuotePositions(linear, offsets[0], quote.length);

  if (!positions) throw new ORPCError("BAD_REQUEST", { message: "The quote has no text" });

  if (input.singleText && positions.start.segment !== positions.end.segment) {
    throw new ORPCError("BAD_REQUEST", {
      message: "A suggestion needs a quote within one paragraph, without line breaks"
    });
  }

  return { anchor: encodeAnchor(positions), blockID: blockID ?? positions.start.segment.blockID };
};
const resolvePosition = (
  document: Doc,
  linear: LinearText,
  position: string
): TextPosition | null => {
  const absolute = createAbsolutePositionFromRelativePosition(
    decodeRelativePosition(Buffer.from(position, "base64")),
    document
  );
  const segment = linear.segments.find(({ text }) => text === absolute?.type);

  return absolute && segment ? { segment, index: absolute.index } : null;
};
const resolveAnchor = (document: Doc, linear: LinearText, anchor: CommentAnchor) => {
  const start = resolvePosition(document, linear, anchor.start);
  const end = resolvePosition(document, linear, anchor.end);

  if (!start || !end) return null;

  const startOffset = start.segment.start + start.index;
  const endOffset = end.segment.start + end.index;

  if (endOffset < startOffset) return null;

  return { start, end, text: linear.source.slice(startOffset, endOffset) };
};
/** States of threads on one document; reads its text once and anchors orphaned quotes again. */
const getAnchorStates = (document: Doc, threads: ThreadAnchorInput[]): AnchorState[] => {
  const linear = getLinearText(document);

  return threads.map((thread): AnchorState => {
    if (thread.anchor) {
      const resolved = resolveAnchor(document, linear, thread.anchor);

      // An empty range means the quoted text was deleted or moved.
      if (!resolved?.text) {
        const anchor = thread.quote ? findSingleQuote(linear, thread.blockID, thread.quote) : null;

        return anchor
          ? { status: "active", text: thread.quote, anchor }
          : { status: "orphaned", text: null };
      }

      return {
        status: resolved.text === thread.quote ? "active" : "outdated",
        text: resolved.text
      };
    }

    if (thread.blockID && !linear.blocks.has(thread.blockID)) {
      return { status: "orphaned", text: null };
    }

    return { status: "active", text: null };
  });
};
const anchorConflict = (message: string) => {
  return new ORPCError("CONFLICT", {
    message,
    data: { hints: ["Read the entry again, and edit it directly or create a new suggestion"] }
  });
};
/** Replaces the anchored text, keeping its formatting; returns the new text's anchor, if any. */
const replaceAnchoredText = (
  document: Doc,
  anchor: CommentAnchor,
  quote: string,
  replacement: string
): CommentAnchor | null => {
  const resolved = resolveAnchor(document, getLinearText(document), anchor);

  if (resolved?.text !== quote) throw anchorConflict("The quoted text changed");

  const { start, end } = resolved;

  if (start.segment !== end.segment) {
    throw anchorConflict(
      "A suggestion can replace only text within one paragraph, without line breaks"
    );
  }

  const { text } = start.segment;
  let offset = 0;
  const attributes = text.toDelta().find(({ insert }: { insert: unknown }) => {
    offset += typeof insert === "string" ? insert.length : 1;

    return offset > start.index;
  })?.attributes;

  text.delete(start.index, end.index - start.index);
  text.insert(start.index, replacement, attributes ?? {});

  if (!replacement) return null;

  return encodeAnchor({
    start: { segment: start.segment, index: start.index },
    end: { segment: start.segment, index: start.index + replacement.length }
  });
};

export { createAnchor, getAnchorStates, replaceAnchoredText };
export type { AnchorState };
