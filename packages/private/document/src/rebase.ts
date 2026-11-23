import { normalizeElementAttributes } from "./element";
import type { ContentNode } from "./types";

interface RebaseOptions {
  /** Takes the suggested side of a block both change; removals or moves of changed blocks fail. */
  preferSuggested?: boolean;
}
interface Hunk {
  from: number;
  to: number;
  tokens: string[];
}

type Attributes = Record<string, unknown>;

// Words, spaces and single punctuation marks, so edits merge by word.
const WORD_PATTERN = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu;

// Larger changed parts, e.g. a rewritten long code block, conflict, as diffing them is slow.
const MAX_DIFF_CELLS = 1_000_000;

class RebaseConflict extends Error {}
/** A removal or move of blocks the other side changed, which no side's version can resolve. */
class StructureConflict extends RebaseConflict {}

// Set for one merge, which runs synchronously.
let isSuggestedPreferred = false;

const conflict = (): never => {
  throw new RebaseConflict();
};
const structureConflict = (): never => {
  throw new StructureConflict();
};
/** Sorted keys, without empty values, so versions with other defaults or key order match. */
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);

  if (!value || typeof value !== "object") return value;

  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined);

  return Object.fromEntries(
    entries.sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)])
  );
};
const isSame = (a: unknown, b: unknown) => {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
};
const getID = (node: ContentNode) => {
  return typeof node.attrs?.id === "string" ? node.attrs.id : null;
};
const toTokens = (nodes: ContentNode[] = []) => {
  return nodes.flatMap((node) => {
    if (node.type !== "text") return [JSON.stringify(normalize(node))];

    const marks = normalize(node.marks ?? []);

    return (node.text?.match(WORD_PATTERN) ?? []).map((text) => JSON.stringify([text, marks]));
  });
};
const fromTokens = (tokens: string[]): ContentNode[] => {
  const nodes: ContentNode[] = [];

  for (const token of tokens) {
    const parsed = JSON.parse(token) as ContentNode | [string, ContentNode["marks"]];
    const previous = nodes[nodes.length - 1];

    if (!Array.isArray(parsed)) {
      nodes.push(parsed);
      continue;
    }

    const [text, marks] = parsed;
    const node: ContentNode = marks?.length
      ? { type: "text", text, marks }
      : { type: "text", text };
    const isJoined = previous?.type === "text" && isSame(previous.marks ?? [], marks ?? []);

    if (isJoined) previous.text = `${previous.text ?? ""}${text}`;
    else nodes.push(node);
  }

  return nodes;
};
/** The changed runs of tokens, by their range in the base. */
const diffTokens = (base: string[], other: string[]): Hunk[] => {
  const lengths = Array.from({ length: base.length + 1 }, () => new Uint32Array(other.length + 1));
  const hunks: Hunk[] = [];

  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = other.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        base[i] === other[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  let i = 0;
  let j = 0;
  let hunk: Hunk | null = null;

  while (i < base.length || j < other.length) {
    const isKept = i < base.length && j < other.length && base[i] === other[j];

    if (isKept) {
      hunk = null;
      i += 1;
      j += 1;
      continue;
    }

    if (!hunk) {
      hunk = { from: i, to: i, tokens: [] };
      hunks.push(hunk);
    }

    const takesOther =
      i === base.length || (j < other.length && lengths[i][j + 1] >= lengths[i + 1][j]);

    if (takesOther) {
      hunk.tokens.push(other[j]);
      j += 1;
    } else {
      i += 1;
      hunk.to = i;
    }
  }

  return hunks;
};
/** As `diffTokens`, without the common start and end; a conflict when the rest is too large. */
const getHunks = (base: string[], other: string[]): Hunk[] => {
  let start = 0;
  let end = 0;

  while (start < base.length && start < other.length && base[start] === other[start]) start += 1;

  while (
    end < base.length - start &&
    end < other.length - start &&
    base[base.length - 1 - end] === other[other.length - 1 - end]
  ) {
    end += 1;
  }

  const changed = base.slice(start, base.length - end);
  const otherChanged = other.slice(start, other.length - end);

  if (changed.length * otherChanged.length > MAX_DIFF_CELLS) conflict();

  return diffTokens(changed, otherChanged).map((hunk) => {
    return { ...hunk, from: hunk.from + start, to: hunk.to + start };
  });
};
const isInsertion = ({ from, to }: Hunk) => from === to;
/** Conflicts when both sides change the same words. */
const mergeInline = (
  base: ContentNode[] = [],
  current: ContentNode[] = [],
  suggested: ContentNode[] = []
) => {
  const baseTokens = toTokens(base);
  const hunks = [
    ...getHunks(baseTokens, toTokens(current)),
    ...getHunks(baseTokens, toTokens(suggested))
  ].sort((a, b) => a.from - b.from || a.to - b.to);
  const tokens: string[] = [];

  let at = 0;
  let previous: Hunk | null = null;

  for (const hunk of hunks) {
    // An insertion before a changed word goes first; two at one place conflict.
    const isOverlapping =
      previous &&
      (hunk.from < previous.to ||
        (isInsertion(previous) && isInsertion(hunk) && hunk.from === previous.from));

    if (isOverlapping && !isSame(hunk, previous)) conflict();

    if (isOverlapping) continue;

    tokens.push(...baseTokens.slice(at, hunk.from), ...hunk.tokens);
    at = hunk.to;
    previous = hunk;
  }

  return fromTokens([...tokens, ...baseTokens.slice(at)]);
};
const mergeAttributes = (
  base: Attributes = {},
  current: Attributes = {},
  suggested: Attributes = {}
) => {
  const names = new Set([...Object.keys(current), ...Object.keys(suggested)]);
  const merged: Attributes = {};

  for (const name of names) {
    const isCurrentChanged = !isSame(current[name], base[name]);
    const isSuggestedChanged = !isSame(suggested[name], base[name]);

    if (isCurrentChanged && isSuggestedChanged && !isSame(current[name], suggested[name])) {
      conflict();
    }

    const value = isSuggestedChanged ? suggested[name] : current[name];

    // Removed by one side.
    if (value !== undefined) merged[name] = value;
  }

  return merged;
};
/** Element props merge one by one; the source follows them, as the editor writes it. */
const mergeElementAttributes = (
  base: Attributes = {},
  current: Attributes = {},
  suggested: Attributes = {}
) => {
  const others = ({ source: _source, props: _props, ...attrs }: Attributes) => attrs;
  const attrs = mergeAttributes(others(base), others(current), others(suggested));
  const props = mergeAttributes(
    base.props as Attributes,
    current.props as Attributes,
    suggested.props as Attributes
  );

  try {
    return normalizeElementAttributes({ ...attrs, props });
  } catch {
    return conflict();
  }
};
const hasIDs = (nodes: ContentNode[]) => nodes.every(getID);
const hasBlocks = (nodes: ContentNode[] = []) => nodes.length > 0 && hasIDs(nodes);
const mergeNodeParts = (
  base: ContentNode,
  current: ContentNode,
  suggested: ContentNode
): ContentNode => {
  const isList =
    hasBlocks(base.content) || hasBlocks(current.content) || hasBlocks(suggested.content);

  if (isSame(current, base)) return suggested;

  if (isSame(suggested, base) || isSame(current, suggested)) return current;

  const hasAttributes = Boolean(base.attrs || current.attrs || suggested.attrs);
  const hasContent = Boolean(base.content || current.content || suggested.content);
  const merged: ContentNode = { type: current.type };

  if (current.type !== suggested.type) conflict();

  if (hasAttributes) {
    merged.attrs =
      current.type === "element"
        ? mergeElementAttributes(base.attrs, current.attrs, suggested.attrs)
        : mergeAttributes(base.attrs, current.attrs, suggested.attrs);
  }

  if (hasContent) {
    merged.content = isList
      ? mergeBlocks(base.content ?? [], current.content ?? [], suggested.content ?? [])
      : mergeInline(base.content, current.content, suggested.content);
  }

  return merged;
};
const mergeNode = (base: ContentNode, current: ContentNode, suggested: ContentNode) => {
  if (!isSuggestedPreferred) return mergeNodeParts(base, current, suggested);

  try {
    return mergeNodeParts(base, current, suggested);
  } catch (error) {
    if (error instanceof StructureConflict || !(error instanceof RebaseConflict)) throw error;

    return suggested;
  }
};
/** By ID; a conflict when one side removes a block the other changed, or both move blocks. */
const mergeBlocks = (base: ContentNode[], current: ContentNode[], suggested: ContentNode[]) => {
  const ids = (nodes: ContentNode[]) => nodes.map(getID).filter((id): id is string => id !== null);
  const [baseIDs, currentIDs, suggestedIDs] = [ids(base), ids(current), ids(suggested)];
  const order = (list: string[], other: string[]) => list.filter((id) => other.includes(id));
  const isMoved = (list: string[]) => !isSame(order(list, baseIDs), order(baseIDs, list));
  const byID = (nodes: ContentNode[]) => new Map(nodes.map((node) => [getID(node), node]));
  const baseNodes = byID(base);
  const result: ContentNode[] = [];

  if (isSame(current, base)) return suggested;

  if (isSame(suggested, base)) return current;

  if (isMoved(currentIDs) && isMoved(suggestedIDs)) structureConflict();

  // In the current order, or the suggested one when only it moves blocks.
  const [skeleton, other] = isMoved(suggestedIDs) ? [suggested, current] : [current, suggested];
  const [skeletonNodes, otherNodes] = [byID(skeleton), byID(other)];

  for (const node of skeleton) {
    const id = getID(node)!;
    const baseNode = baseNodes.get(id);
    const otherNode = otherNodes.get(id);

    if (!baseNode) {
      result.push(node);
    } else if (!otherNode) {
      // Removed by the other side; a conflict when this side changed it.
      if (!isSame(node, baseNode)) structureConflict();
    } else {
      const [currentNode, suggestedNode] =
        skeleton === current ? [node, otherNode] : [otherNode, node];

      result.push(mergeNode(baseNode, currentNode, suggestedNode));
    }
  }

  for (const [index, node] of other.entries()) {
    const id = getID(node)!;
    const isNew = !baseNodes.has(id) && !result.some((item) => getID(item) === id);
    const isRemovedHere = baseNodes.has(id) && !skeletonNodes.has(id);

    if (isRemovedHere && !isSame(node, baseNodes.get(id))) structureConflict();

    if (!isNew) continue;

    // After the nearest block before it that the result has, or first.
    const anchorIDs = other.slice(0, index).map(getID).reverse();
    const anchor = anchorIDs.find((anchorID) => result.some((item) => getID(item) === anchorID));
    const position = anchor ? result.findIndex((item) => getID(item) === anchor) + 1 : 0;

    result.splice(position, 0, node);
  }

  return result;
};
const attempt = <T>(merge: () => T): T | null => {
  try {
    return merge();
  } catch (error) {
    if (error instanceof RebaseConflict) return null;

    throw error;
  }
};

/** Suggested blocks on top of the current ones; null when both change the same parts. */
const rebaseBlocks = (
  base: ContentNode[],
  current: ContentNode[],
  suggested: ContentNode[],
  { preferSuggested = false }: RebaseOptions = {}
): ContentNode[] | null => {
  if (isSame(current, base)) return suggested;

  isSuggestedPreferred = preferSuggested;

  try {
    return attempt(() => {
      // Blocks without IDs merge as one node; empty lists, e.g. a deletion, merge by ID.
      if (!hasIDs(base) || !hasIDs(current) || !hasIDs(suggested)) {
        return base.length === 1 && current.length === 1 && suggested.length === 1
          ? [mergeNode(base[0], current[0], suggested[0])]
          : conflict();
      }

      return mergeBlocks(base, current, suggested);
    });
  } finally {
    isSuggestedPreferred = false;
  }
};
/** As `rebaseBlocks`, for plain text; `preferSuggested` takes the suggestion on a conflict. */
const rebaseText = (
  base: string,
  current: string,
  suggested: string,
  { preferSuggested = false }: RebaseOptions = {}
): string | null => {
  const toNodes = (text: string): ContentNode[] => (text ? [{ type: "text", text }] : []);
  const merged = attempt(() => mergeInline(toNodes(base), toNodes(current), toNodes(suggested)));

  if (!merged) return preferSuggested ? suggested : null;

  return merged.map(({ text }) => text ?? "").join("");
};

export { rebaseBlocks, rebaseText };
export type { RebaseOptions };
