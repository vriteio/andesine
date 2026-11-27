import { type CommentSuggestionData, type DatabaseTransaction } from "@andesine/server/database";
import { type CommentAnchor, type CommentAnchorStatus } from "@andesine/contracts/entities";
import { type ContentNode, rebaseBlocks, rebaseText } from "@andesine/document";
import { DOCUMENT_ID_NODE_TYPES } from "@andesine/document/tiptap";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { getContentSnapshot } from "#backend/collaboration";
import {
  decodeBlocksMDX,
  findBlockRange,
  findNestedBlock,
  getLinkedEntryIDs,
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
  title?: string;
}
interface PrepareSuggestionInput {
  entryID: string;
  schemaRevisionID: string | null;
  authorization: AuthorizedCollectionTree;
  /** Changed in place: the patch is applied to it. */
  document: ContentNode;
  patch: SuggestionPatch;
}

const ID_NODE_TYPES = new Set<string>(DOCUMENT_ID_NODE_TYPES);

const suggestionError = (message: string) => {
  return new ORPCError("BAD_REQUEST", {
    message,
    data: {
      hints: ["Read the entry again with contentFormat blocks, and use the current block IDs"]
    }
  });
};
/** Rebases and clients pair blocks by ID. */
const assignBlockIDs = (nodes: ContentNode[]): void => {
  for (const node of nodes) {
    const needsID = ID_NODE_TYPES.has(node.type) && !node.attrs?.id;

    if (needsID) node.attrs = { ...node.attrs, id: randomUUID() };

    if (node.content) assignBlockIDs(node.content);
  }
};
/** The title as typed, for rebasing; not `getContentTitle`, which normalizes it. */
const getTitleText = ({ content }: ContentNode) => {
  const title = content?.find(({ type }) => type === "title");

  return title?.content?.map(({ text }) => text ?? "").join("") ?? "";
};
const getRangeBlocks = (document: ContentNode, target: BlockRangeTarget) => {
  const range = findBlockRange(document, target);

  return range && range.container.slice(range.start, range.start + range.count);
};
/** A suggestion's blocks now, first to last; null when none are left or they're split. */
const getSpanBlocks = (document: ContentNode, { blockIDs, after }: BlockRangeTarget) => {
  const ranges = blockIDs.flatMap(
    (id) => findBlockRange(document, { blockIDs: [id], after: null }) ?? []
  );
  const starts = ranges.map(({ start }) => start);
  const isSplit = ranges.some(({ container }) => container !== ranges[0].container);

  if (!blockIDs.length) return getRangeBlocks(document, { blockIDs, after });

  if (!ranges.length || isSplit) return null;

  return ranges[0].container.slice(Math.min(...starts), Math.max(...starts) + 1);
};
const rebaseSuggestion = (
  document: ContentNode,
  suggestion: CommentSuggestionData
): CommentSuggestionData | null => {
  if (suggestion.title) {
    const base = getTitleText(document);
    const suggested = rebaseText(suggestion.title.base, base, suggestion.title.suggested);

    return suggested === null ? null : { ...suggestion, title: { base, suggested } };
  }

  const current = getSpanBlocks(document, suggestion);
  const blocks = current && rebaseBlocks(suggestion.base, current, suggestion.blocks);
  // The span now, e.g. with blocks added inside it since; empty for an insertion.
  const blockIDs = current?.map(({ attrs }) => String(attrs?.id)) ?? [];

  return current && blocks ? { ...suggestion, blockIDs, base: current, blocks } : null;
};
const getStaleStatus = (
  document: ContentNode,
  suggestion: CommentSuggestionData
): CommentAnchorStatus => {
  const { blockIDs, after, title } = suggestion;
  const ids = after ? [...blockIDs, after] : blockIDs;
  const hasBlocks = ids.some((id) => findNestedBlock(document, id));

  return title || hasBlocks ? "outdated" : "orphaned";
};
const prepareSuggestion = async (
  database: DatabaseTransaction,
  workspaceID: string,
  input: PrepareSuggestionInput
): Promise<CommentSuggestionData> => {
  const { authorization, document, patch } = input;

  if (patch.title !== undefined) {
    const base = getTitleText(document);

    if (patch.title === base) throw suggestionError("The suggestion changes nothing");

    return {
      blockIDs: [],
      after: null,
      base: [],
      blocks: [],
      title: { base, suggested: patch.title }
    };
  }

  const range = findBlockRange(document, patch);

  if (!range) throw suggestionError("The blocks aren't found, or aren't consecutive");

  const base = range.container.slice(range.start, range.start + range.count);
  // Before the patch changes the document.
  const linkedEntryIDs = getLinkedEntryIDs(document);
  // Empty MDX suggests deleting the blocks, not an empty paragraph.
  const mdx = patch.mdx?.trim();
  const decoded = patch.blocks ?? (mdx ? await decodeBlocksMDX(mdx, base) : []);
  const { content: blocks = [] } = await resolveEntryLinks(
    database,
    workspaceID,
    { type: "doc", content: decoded },
    authorization,
    undefined,
    linkedEntryIDs
  );

  if (isDeepStrictEqual(base, blocks)) throw suggestionError("The suggestion changes nothing");

  assignBlockIDs(blocks);
  range.container.splice(range.start, range.count, ...blocks);
  await prepareEntryContent(database, workspaceID, {
    entryID: input.entryID,
    schemaRevisionID: input.schemaRevisionID,
    document,
    authorization,
    linkedEntryIDs
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

export { createTextSuggestion, getStaleStatus, prepareSuggestion, rebaseSuggestion };
export type { SuggestionPatch };
