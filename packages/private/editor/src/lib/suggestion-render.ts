import {
  DOMSerializer,
  Fragment,
  type Node as ProseMirrorNode,
  type Schema
} from "@tiptap/pm/model";
import { Decoration } from "@tiptap/pm/view";
import { getBlocks } from "#editor/extensions/comments";
import type { AttributeChange } from "./suggestion-diff";

interface SuggestedComment {
  threadID: string;
  blockID: string;
  quote: string;
}

const CHIP_VALUE_LENGTH = 24;
// What the tints show, for screen readers; blocks keep their own roles, e.g. list items.
const CHANGE_ATTRIBUTES: Record<string, Record<string, string>> = {
  "suggestion-added": { role: "insertion" },
  "suggestion-removed": { role: "deletion" },
  "suggestion-commented": { "aria-description": "Suggested replacement" },
  "suggestion-added-block": { "aria-description": "Suggested insertion" },
  "suggestion-removed-block": { "aria-description": "Suggested deletion" }
};

/** Opens the thread on click, as a comment highlight does. */
const getThreadAttributes = (threadID?: string): Record<string, string> => {
  return threadID ? { "data-comment-thread": threadID, "data-comment-text": "" } : {};
};
const getChangeAttributes = (className: string) => {
  const name = className.split(" ").find((item) => item in CHANGE_ATTRIBUTES);

  return name ? CHANGE_ATTRIBUTES[name] : {};
};
const hashContent = (value: unknown) => {
  let result = 0;

  for (const char of JSON.stringify(value)) result = (result * 31 + char.charCodeAt(0)) | 0;

  return result.toString(36);
};
const getSuggestionAttributes = (className: string, threadID?: string) => {
  return { ...getThreadAttributes(threadID), ...getChangeAttributes(className) };
};
const markSuggestion = (element: HTMLElement, className: string, threadID?: string) => {
  const attributes = getSuggestionAttributes(className, threadID);

  element.classList.add(...className.split(" ").filter(Boolean));
  element.contentEditable = "false";

  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);

  return element;
};
/** One change in full, e.g. "Language: bash → sh", else a count, as the card lists them. */
const getChipAttributes = (changes: AttributeChange[]) => {
  const [{ label, before, after }] = changes;
  const clip = (value: string) => {
    return value.length > CHIP_VALUE_LENGTH ? `${value.slice(0, CHIP_VALUE_LENGTH)}…` : value;
  };
  const value = before && after ? `${clip(before)} → ${clip(after)}` : after && clip(after);
  const single = value ? `${label}: ${value}` : `${label} ${before ? "removed" : "changed"}`;
  const text = changes.length === 1 ? single : `${changes.length} changes`;

  return { "data-suggestion-attributes": text, "aria-description": `Suggested change: ${text}` };
};
const renderSuggestionText = (
  schema: Schema,
  node: ProseMirrorNode,
  className: string,
  threadID?: string
) => {
  const element = markSuggestion(document.createElement("span"), className, threadID);

  element.append(DOMSerializer.fromSchema(schema).serializeFragment(Fragment.from(node)));

  return element;
};
/** The node itself, so a list item or table row fits its parent. */
const renderSuggestionBlock = (
  schema: Schema,
  node: ProseMirrorNode,
  className: string,
  threadID?: string
) => {
  const element = DOMSerializer.fromSchema(schema).serializeNode(node) as HTMLElement;

  return markSuggestion(element, className, threadID);
};

/** The range of `text` in a block, or null. */
const findText = (node: ProseMirrorNode, pos: number, text: string) => {
  const offset = node.textContent.indexOf(text);
  const end = offset + text.length;

  let index = 0;
  let from: number | null = null;
  let to: number | null = null;

  if (offset < 0) return null;

  node.descendants((child, childPos) => {
    const start = index;

    if (!child.isText) return true;

    index += child.text!.length;
    if (from === null && offset < index) from = pos + 1 + childPos + offset - start;
    if (to === null && end <= index) to = pos + 1 + childPos + end - start;

    return false;
  });

  return from !== null && to !== null ? { from, to } : null;
};
const drawSuggestedComments = (doc: ProseMirrorNode, comments: SuggestedComment[]) => {
  const blocks = getBlocks(doc);

  return comments.flatMap(({ threadID, blockID, quote }) => {
    const block = blocks.get(blockID);
    const range = block && findText(block.node, block.pos, quote);
    const attributes = { class: "comment-highlight", ...getThreadAttributes(threadID) };

    return range ? [Decoration.inline(range.from, range.to, attributes)] : [];
  });
};

export {
  drawSuggestedComments,
  getChangeAttributes,
  getChipAttributes,
  getSuggestionAttributes,
  getThreadAttributes,
  hashContent,
  markSuggestion,
  renderSuggestionBlock,
  renderSuggestionText
};
export type { SuggestedComment };
