import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { rebaseBlocks, rebaseText, type ContentNode, type RebaseOptions } from "@andesine/document";
import type { EditorCommentSuggestion, EditorCommentThread } from "#editor/client-types";
import { getBlocks } from "#editor/extensions/comments";
import type { SuggestionTarget } from "./suggestion-apply";

/** The suggestion's blocks now, first to last; null when gone or in other parents. */
const getCurrentBlocks = (doc: ProseMirrorNode, { blockIDs, after }: SuggestionTarget) => {
  const blocks = getBlocks(doc);
  const positions = blockIDs.flatMap((id) => {
    const block = blocks.get(id);

    return block ? [doc.resolve(block.pos)] : [];
  });
  const parent = positions[0]?.parent;
  const indexes = positions.map(($pos) => $pos.index());
  const first = Math.min(...indexes);

  if (!blockIDs.length) return after && !blocks.has(after) ? null : [];

  if (!parent || positions.some(($pos) => $pos.parent !== parent)) return null;

  return Array.from({ length: Math.max(...indexes) - first + 1 }, (_, index) => {
    return parent.child(first + index);
  });
};
/** The suggestion rebased onto the live content, as the server does; null on a conflict. */
const rebaseSuggestion = (
  doc: ProseMirrorNode,
  suggestion: EditorCommentSuggestion,
  options?: RebaseOptions
): EditorCommentSuggestion | null => {
  const { schema } = doc.type;
  // In the editor's JSON, so defaults and key order don't count as changes.
  const normalize = (json: JSONContent) => schema.nodeFromJSON(json).toJSON() as ContentNode;
  const { title } = suggestion;

  if (title) {
    const base = doc.firstChild?.textContent ?? "";
    const suggested = rebaseText(title.base, base, title.suggested, options);

    return suggested === null ? null : { ...suggestion, title: { base, suggested } };
  }

  const current = getCurrentBlocks(doc, suggestion)?.map((node) => node.toJSON() as ContentNode);

  try {
    const base = suggestion.base.map(normalize);
    const blocks =
      current && rebaseBlocks(base, current, suggestion.blocks.map(normalize), options);
    // The span now, with blocks added inside it since; empty for an insertion.
    const blockIDs = current?.map(({ attrs }) => String(attrs?.id)) ?? [];

    return current && blocks ? { ...suggestion, blockIDs, base: current, blocks } : null;
  } catch {
    // Blocks that don't fit the schema.
    return null;
  }
};
/** Outdated or orphaned, as the server finds it. */
const getStaleStatus = (
  doc: ProseMirrorNode,
  { blockIDs, after, title }: EditorCommentSuggestion
): EditorCommentThread["status"] => {
  const blocks = getBlocks(doc);
  const ids = after ? [...blockIDs, after] : blockIDs;

  return title || ids.some((id) => blocks.has(id)) ? "outdated" : "orphaned";
};
const isOpenSuggestion = ({ suggestion, resolved, status }: EditorCommentThread) => {
  return Boolean(suggestion && !suggestion.applied && !resolved && status === "active");
};
/** Open suggestions use Reject; stale ones stay resolved until their suggestion updates. */
const canToggleResolved = ({ suggestion, resolved, status }: EditorCommentThread) => {
  const isOpen = Boolean(suggestion) && !resolved;
  const isStale = suggestion?.applied === false && status !== "active";

  return !isOpen && !isStale;
};

export { canToggleResolved, getStaleStatus, isOpenSuggestion, rebaseSuggestion };
