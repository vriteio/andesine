import { presentableDiff } from "@codemirror/merge";
import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { mergeInlineContent } from "#editor/extensions/version-diff/inline";
import { capitalize } from "./labels";
import { alignBlocks } from "./suggestion-ranges";

/** Text or a block of the document. */
interface ShownMark {
  type: "text" | "block";
  from: number;
  to: number;
  change: SuggestionChange;
}
/** Text or a block of the other version, which the document doesn't have. */
interface MissingMark {
  type: "text" | "block";
  at: number;
  change: SuggestionChange;
  node: JSONContent;
  /** A changed block's current version, to diff the copy against. */
  base?: JSONContent;
}
interface ShownCodeChange {
  from: number;
  to: number;
  change: "added" | "removed";
}
interface MissingCodeChange {
  at: number;
  text: string;
  change: "added" | "removed";
}
interface CodeMark {
  type: "code";
  from: number;
  to: number;
  changes: CodeChange[];
}
/** Missing values aren't set. */
interface AttributeChange {
  name: string;
  label: string;
  before?: string;
  after?: string;
}
/** Drawn as a chip, beside the content diff. */
interface AttributesMark {
  type: "attributes";
  from: number;
  to: number;
  changes: AttributeChange[];
}

/** By the suggestion: "added" is in the suggested version only, "removed" in the main one. */
type SuggestionChange = "added" | "removed" | "changed";
type CodeChange = ShownCodeChange | MissingCodeChange;
type SuggestionMark = ShownMark | MissingMark | CodeMark | AttributesMark;

const MIN_INLINE_SIMILARITY = 0.5;
// Short texts always diff inline, as their struck words stay readable, e.g. a table cell.
const SHORT_TEXT_LENGTH = 60;
const TEXT_BLOCK_TYPES = new Set(["paragraph", "heading", "title"]);
// Compared whole: their content isn't shown by ProseMirror, e.g. code in a code editor.
const LEAF_BLOCK_TYPES = new Set(["codeBlock", "image", "horizontalRule", "property"]);
const ATTRIBUTE_LABELS: Record<string, string> = { alt: "Alt text" };
// Shown as the suggested look, not a chip, e.g. a heading's level.
const VISUAL_ATTRIBUTES = new Set(["level", "checked", "start", "size"]);
// Not shown as changes: identity, layout and derived values.
const HIDDEN_ATTRIBUTES = new Set([
  "id",
  "name",
  "source",
  "selfClosing",
  "assetID",
  "aspectRatio",
  "colwidth",
  "colspan",
  "rowspan",
  "align"
]);

const formatAttribute = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;

  return typeof value === "object" ? JSON.stringify(value) : String(value);
};
/** For elements, compares their props. */
const getAttributeChanges = (
  type: string,
  before: Record<string, unknown> = {},
  after: Record<string, unknown> = {}
): AttributeChange[] => {
  const isElement = type === "element";
  const pick = (attrs: Record<string, unknown>) => {
    return ((isElement ? attrs.props : attrs) ?? {}) as Record<string, unknown>;
  };
  const [main, suggested] = [pick(before), pick(after)];
  const names = new Set([...Object.keys(main), ...Object.keys(suggested)]);

  return [...names].flatMap((name) => {
    const [previous, next] = [formatAttribute(main[name]), formatAttribute(suggested[name])];
    const isHidden = !isElement && HIDDEN_ATTRIBUTES.has(name);

    if (isHidden || previous === next) return [];

    const label = (!isElement && ATTRIBUTE_LABELS[name]) || capitalize(name);

    return [{ name, label, before: previous, after: next }];
  });
};
/** Two versions of one block, e.g. not another element or a new image. */
const isSameBlock = (node: ProseMirrorNode, other: ProseMirrorNode) => {
  const isSameElement = node.type.name !== "element" || node.attrs.name === other.attrs.name;
  const isSameImage = node.type.name !== "image" || node.attrs.assetID === other.attrs.assetID;

  return node.type === other.type && isSameElement && isSameImage;
};
const getColumnWidths = (table: ProseMirrorNode): unknown[] => {
  return table.firstChild?.content.content.map(({ attrs }) => attrs.colwidth) ?? [];
};
/** Whether columns in both versions have other widths; new columns aren't a resize. */
const isResized = (main: ProseMirrorNode, suggested: ProseMirrorNode) => {
  const [before, after] = [getColumnWidths(main), getColumnWidths(suggested)];

  return before.some((width, index) => {
    return index < after.length && JSON.stringify(width) !== JSON.stringify(after[index]);
  });
};
const getBlockAttributeChanges = (main: ProseMirrorNode, suggested: ProseMirrorNode) => {
  const changes = getAttributeChanges(main.type.name, main.attrs, suggested.attrs);
  const isTableResized = main.type.name === "table" && isResized(main, suggested);

  return isTableResized ? [...changes, { name: "colwidth", label: "Column widths" }] : changes;
};
/** Null when it doesn't fit the schema. */
const toNode = (doc: ProseMirrorNode, json: JSONContent) => {
  try {
    return doc.type.schema.nodeFromJSON(json);
  } catch {
    return null;
  }
};
const diffText = (start: number, merged: JSONContent[], suggested: boolean) => {
  const marks: SuggestionMark[] = [];

  let at = start;

  for (const item of merged) {
    const change = item.diff as "added" | "removed" | undefined;
    const isShown = change !== (suggested ? "removed" : "added");

    if (!isShown) {
      marks.push({ type: "text", at, change: change!, node: item });
      continue;
    }

    const to = at + (item.type === "text" ? (item.text?.length ?? 0) : 1);

    if (change) marks.push({ type: "text", from: at, to, change });

    at = to;
  }

  return marks;
};
const diffCode = (shown: string, other: string, suggested: boolean): CodeChange[] => {
  const [previous, current] = suggested ? [other, shown] : [shown, other];

  return presentableDiff(previous, current, { scanLimit: 500 }).flatMap((change) => {
    const removed = previous.slice(change.fromA, change.toA);
    const added = current.slice(change.fromB, change.toB);
    const result: CodeChange[] = [];

    if (suggested) {
      if (removed) result.push({ at: change.fromB, text: removed, change: "removed" });

      if (added) result.push({ from: change.fromB, to: change.toB, change: "added" });
    } else {
      if (removed) result.push({ from: change.fromA, to: change.toA, change: "removed" });

      if (added) result.push({ at: change.toA, text: added, change: "added" });
    }

    return result;
  });
};
const diffPair = (
  doc: ProseMirrorNode,
  at: number,
  shown: JSONContent,
  other: JSONContent,
  suggested: boolean
): SuggestionMark[] => {
  const node = doc.nodeAt(at)!;
  const otherNode = toNode(doc, other);
  const to = at + node.nodeSize;
  const isSame = Boolean(otherNode && isSameBlock(node, otherNode));
  const [main, fork] = suggested ? [otherNode!, node] : [node, otherNode!];
  const attributes = isSame ? getBlockAttributeChanges(main, fork) : [];
  const isElement = node.type.name === "element";
  const isRestyled = !isElement && attributes.some(({ name }) => VISUAL_ATTRIBUTES.has(name));
  const chipChanges = attributes.filter(({ name }) => isElement || !VISUAL_ATTRIBUTES.has(name));
  const chip: SuggestionMark[] = chipChanges.length
    ? [{ type: "attributes", from: at, to, changes: chipChanges }]
    : [];
  // Restyled blocks are tinted where the suggested version shows.
  const tint: SuggestionMark[] =
    suggested && isRestyled ? [{ type: "block", from: at, to, change: "changed" }] : [];
  const isContainer = !LEAF_BLOCK_TYPES.has(node.type.name) && !node.isTextblock && !node.isLeaf;
  const isDiffed = isSame && (suggested || !isRestyled);

  if (isDiffed && node.type.name === "codeBlock") {
    const changes = diffCode(node.textContent, otherNode!.textContent, suggested);

    return [...chip, { type: "code", from: at, to, changes }];
  }

  if (isDiffed && TEXT_BLOCK_TYPES.has(shown.type ?? "")) {
    const [previous, current] = suggested ? [other, shown] : [shown, other];
    const merge = mergeInlineContent(previous.content, current.content);
    const lengths = [node.textContent.length, otherNode!.textContent.length];
    // Share of the shorter text kept, so a short text with an addition still diffs inline.
    const kept = (merge.similarity * Math.max(...lengths, 1)) / Math.max(Math.min(...lengths), 1);
    const isShort = Math.max(...lengths) <= SHORT_TEXT_LENGTH;

    if (isShort || kept >= MIN_INLINE_SIMILARITY) {
      return [...tint, ...chip, ...diffText(at + 1, merge.inline, suggested)];
    }
  }

  if (isDiffed && isContainer) {
    const children = diffBlocks(doc, at + 1, shown.content ?? [], other.content ?? [], suggested);

    return [...tint, ...chip, ...children];
  }

  // Blocks without content, e.g. an image with new alt text, show only their attributes.
  if (isDiffed && LEAF_BLOCK_TYPES.has(node.type.name)) return [...tint, ...chip];

  return [
    { type: "block", from: at, to, change: "changed" },
    // After the hidden block, so its comment anchors stay at the copy, which marks its changes.
    { type: "block", at: to, change: "changed", node: other, base: shown }
  ];
};
/** `suggested`: the document shows the suggested version, as a fork does. */
const diffBlocks = (
  doc: ProseMirrorNode,
  pos: number,
  shown: JSONContent[],
  other: JSONContent[],
  suggested: boolean
): SuggestionMark[] => {
  const steps = suggested ? alignBlocks(other, shown) : alignBlocks(shown, other);
  const marks: SuggestionMark[] = [];
  // Siblings by index, as finding each by position scans its parent again.
  const $pos = doc.resolve(pos);

  let at = pos;
  let index = $pos.index();

  for (const step of steps) {
    const shownNode = suggested ? step.fork : step.main;
    const otherNode = suggested ? step.main : step.fork;
    const node = shownNode ? $pos.parent.child(index++) : null;
    const size = node?.nodeSize ?? 0;
    const change = Boolean(shownNode) === suggested ? "added" : "removed";

    if (shownNode && otherNode) {
      const isSame = toNode(doc, otherNode)?.eq(node!) ?? false;

      if (!isSame) marks.push(...diffPair(doc, at, shownNode, otherNode, suggested));
    } else if (shownNode) {
      marks.push({ type: "block", from: at, to: at + size, change });
    } else if (otherNode) {
      marks.push({ type: "block", at, change, node: otherNode });
    }

    at += size;
  }

  return marks;
};

export { diffBlocks, diffPair, getAttributeChanges };
export type { AttributeChange, CodeChange, SuggestionMark };
