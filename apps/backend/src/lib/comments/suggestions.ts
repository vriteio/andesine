import { getContentAssetIDs } from "@andesine/server/assets";
import { type CommentSuggestionData, type DatabaseTransaction } from "@andesine/server/database";
import { type CommentAnchor, type CommentAnchorStatus } from "@andesine/contracts/entities";
import { type ContentNode } from "@andesine/document";
import { ORPCError } from "@orpc/server";
import { isDeepStrictEqual } from "node:util";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { getContentSnapshot } from "#backend/collaboration";
import {
  decodeBlocksMDX,
  findBlockRange,
  listBlocks,
  prepareEntryContent,
  resolveEntryLinks,
  type BlockRangeTarget
} from "#backend/lib/content";
import { type AuthorizedCollectionTree } from "#backend/lib/policy";
import { replaceAnchoredText } from "./anchors";

interface SuggestionPatch extends BlockRangeTarget {
  blocks?: ContentNode[];
  mdx?: string;
}
interface PrepareSuggestionInput {
  entryID: string;
  schemaRevisionID: string | null;
  authorization: AuthorizedCollectionTree;
  /** Changed in place: the patch is applied to it. */
  document: ContentNode;
  patch: SuggestionPatch;
}

const suggestionError = (message: string) => {
  return new ORPCError("BAD_REQUEST", {
    message,
    data: {
      hints: ["Read the entry again with contentFormat blocks, and use the current block IDs"]
    }
  });
};
const getRangeBlocks = (document: ContentNode, target: BlockRangeTarget) => {
  const range = findBlockRange(document, target);

  return range && range.container.slice(range.start, range.start + range.count);
};
const getSuggestionStatus = (
  document: ContentNode,
  suggestion: CommentSuggestionData
): CommentAnchorStatus => {
  const current = getRangeBlocks(document, suggestion);

  if (current) return isDeepStrictEqual(current, suggestion.base) ? "active" : "outdated";

  const ids = new Set<unknown>([...suggestion.blockIDs, suggestion.after]);
  const hasBlocks = listBlocks(document).some(({ node }) => ids.has(node.attrs?.id));

  return hasBlocks ? "outdated" : "orphaned";
};
const prepareSuggestion = async (
  database: DatabaseTransaction,
  workspaceID: string,
  input: PrepareSuggestionInput
): Promise<CommentSuggestionData> => {
  const { authorization, document, patch } = input;
  const range = findBlockRange(document, patch);

  if (!range) throw suggestionError("The blocks aren't found, or aren't consecutive");

  const base = range.container.slice(range.start, range.start + range.count);
  const decoded = patch.blocks ?? (await decodeBlocksMDX(patch.mdx ?? "", base));
  const { content: blocks = [] } = await resolveEntryLinks(
    database,
    workspaceID,
    { type: "doc", content: decoded },
    authorization
  );
  const assetIDs = new Set(getContentAssetIDs(document));
  const hasNewImages = getContentAssetIDs({ type: "doc", content: blocks }).some((id) => {
    return !assetIDs.has(id);
  });

  if (isDeepStrictEqual(base, blocks)) throw suggestionError("The suggestion changes nothing");

  // shortcut: no new images until open suggestions keep asset references.
  if (hasNewImages) throw suggestionError("A suggestion can only use images of the entry");

  range.container.splice(range.start, range.count, ...blocks);
  await prepareEntryContent(database, workspaceID, {
    entryID: input.entryID,
    schemaRevisionID: input.schemaRevisionID,
    document,
    authorization
  });

  return {
    blockIDs: patch.blockIDs,
    after: patch.blockIDs.length ? null : patch.after,
    base,
    blocks
  };
};
/** A patch for the block that holds the replaced text. */
const createTextSuggestion = (
  document: Doc,
  anchor: CommentAnchor,
  quote: string,
  replacement: string
): CommentSuggestionData => {
  const copy = new Doc();

  try {
    applyUpdate(copy, encodeStateAsUpdate(document));
    replaceAnchoredText(copy, anchor, quote, replacement);

    const changed = getContentSnapshot(copy).document;
    const changedBlocks = listBlocks(changed);
    const block = listBlocks(getContentSnapshot(document).document).find(({ node }, index) => {
      return !isDeepStrictEqual(node, changedBlocks[index]?.node);
    });
    const blockID = block?.node.attrs?.id;

    if (!block || typeof blockID !== "string") {
      throw suggestionError("The suggestion changes nothing");
    }

    const target = { blockIDs: [blockID], after: null };

    return { ...target, base: [block.node], blocks: getRangeBlocks(changed, target) ?? [] };
  } finally {
    copy.destroy();
  }
};

export { createTextSuggestion, getSuggestionStatus, prepareSuggestion };
export type { SuggestionPatch };
