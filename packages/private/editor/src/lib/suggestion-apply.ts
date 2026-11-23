import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { EditorCommentSuggestion } from "#editor/client-types";
import { getBlocks } from "#editor/extensions/comments";

type SuggestionTarget = Pick<EditorCommentSuggestion, "blockIDs" | "after">;

/** Where a suggestion's blocks start, or its insertion goes; at the start, after the title. */
const findSuggestionStart = (
  doc: ProseMirrorNode,
  blocks: ReturnType<typeof getBlocks>,
  { blockIDs, after }: SuggestionTarget
) => {
  const anchor = blocks.get(blockIDs[0] ?? after ?? "");
  const isAtStart = !blockIDs.length && !after && doc.firstChild?.type.name === "title";

  return isAtStart
    ? doc.firstChild!.nodeSize
    : anchor && (blockIDs.length ? anchor.pos : anchor.pos + anchor.node.nodeSize);
};
/** False when its blocks are missing or don't fit. */
const replaceSuggestion = (
  tr: Transaction,
  suggestion: Pick<EditorCommentSuggestion, "blockIDs" | "after" | "blocks" | "title">
): boolean => {
  const { blockIDs, blocks, title } = suggestion;
  const { schema } = tr.doc.type;
  const titleNode = tr.doc.firstChild?.type.name === "title" ? tr.doc.firstChild : null;

  try {
    if (title) {
      if (!titleNode) return false;

      tr.replaceWith(1, titleNode.nodeSize - 1, schema.text(title.suggested));

      return true;
    }

    const found = getBlocks(tr.doc);
    const start = findSuggestionStart(tr.doc, found, suggestion);
    const last = found.get(blockIDs.at(-1) ?? "");
    const isMissing = start === undefined || (blockIDs.length > 0 && !last);

    if (isMissing) return false;

    const end = last ? last.pos + last.node.nodeSize : start;

    tr.replaceWith(
      start,
      end,
      blocks.map((block) => schema.nodeFromJSON(block))
    );

    return true;
  } catch {
    return false;
  }
};

export { findSuggestionStart, replaceSuggestion };
export type { SuggestionTarget };
