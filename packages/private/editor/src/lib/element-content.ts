import { formatElement, parseElement, type ElementValue } from "@andesine/document";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import type {
  ElementAccepts,
  ElementContentRules,
  ElementViewDescription,
  ElementViews
} from "#editor/client-types";

interface Wrapper {
  name: string;
  description: ElementViewDescription;
}
interface WrapGroup {
  wrapper: Wrapper;
  blocks: ProseMirrorNode[];
}
interface ChangedRange {
  from: number;
  to: number;
}

const PARENT_LIST = new Intl.ListFormat("en", { type: "disjunction" });

/** The element views from the `elements` extension's options. */
const getElementViews = (editor: Editor): ElementViews | undefined => {
  return editor.extensionManager.extensions.find(({ name }) => name === "elements")?.options
    .elementViews;
};
const sameName = (left: string, right: string): boolean => {
  return left.toLowerCase() === right.toLowerCase();
};
/** The names of the elements that enclose the position, nearest first. */
const getElementAncestors = (doc: ProseMirrorNode, pos: number | undefined): string[] => {
  const names: string[] = [];

  if (typeof pos !== "number") return names;

  try {
    const $pos = doc.resolve(pos);

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const ancestor = $pos.node(depth);

      if (ancestor.type.name === "element") names.push(ancestor.attrs.name);
    }
  } catch {
    /* The node can be outside the current document while it is replaced. */
  }

  return names;
};
const listsType = (list: ElementAccepts, block: string, element?: string): boolean => {
  if (element) return (list.elements ?? []).some((name) => sameName(name, element));

  return (list.blocks ?? []).includes(block);
};
/** Whether content rules take a block type, e.g. `codeBlock`, or an element by name. */
const acceptsType = (rules: ElementContentRules, block: string, element?: string): boolean => {
  const isAccepted = !rules.accepts || listsType(rules.accepts, block, element);
  const isRejected = Boolean(rules.rejects && listsType(rules.rejects, block, element));

  return isAccepted && !isRejected;
};
/** Whether an element's content rules accept a child block. */
const acceptsBlock = (rules: ElementContentRules, block: ProseMirrorNode): boolean => {
  const element = block.type.name === "element" ? block.attrs.name : undefined;

  return acceptsType(rules, block.type.name, element);
};
/** The content rules of a view's description; null without rules. */
const getRules = (description?: ElementViewDescription | null): ElementContentRules | null => {
  if (!description?.accepts && !description?.rejects) return null;

  return { accepts: description.accepts, rejects: description.rejects };
};
/** The element's content rules, from its view; null without rules. */
const getAccepts = (
  doc: ProseMirrorNode,
  pos: number,
  elementViews: ElementViews
): ElementContentRules | null => {
  const node = doc.nodeAt(pos);

  if (node?.type.name !== "element") return null;

  return getRules(elementViews.describe(node.attrs.name, getElementAncestors(doc, pos)));
};
/**
 * The element's child blocks that its rules don't accept. An only empty paragraph is how an empty
 * element holds its cursor, so it fits; while `typing`, an only paragraph with text fits too, e.g.
 * a slash command that inserts an accepted block.
 */
const getRejectedChildren = (
  doc: ProseMirrorNode,
  pos: number,
  elementViews: ElementViews,
  typing = false
): ProseMirrorNode[] => {
  const node = doc.nodeAt(pos);
  const rules = getAccepts(doc, pos, elementViews);
  const rejected: ProseMirrorNode[] = [];

  if (!node || !rules) return rejected;

  node.forEach((child) => {
    const isPlaceholder =
      child.type.name === "paragraph" && (!child.content.size || (typing && node.childCount === 1));

    if (!isPlaceholder && !acceptsBlock(rules, child)) rejected.push(child);
  });

  return rejected;
};
/**
 * The elements that an element may be directly inside, if it's somewhere else, e.g. `Steps` for a
 * `Step` outside them; null where it may be.
 */
const getMisplacedParents = (
  doc: ProseMirrorNode,
  pos: number,
  elementViews: ElementViews
): string[] | null => {
  const node = doc.nodeAt(pos);
  const parent = doc.resolve(pos).parent;
  const parents = node?.type.name === "element" ? elementViews.parents(node.attrs.name) : null;
  const isPlaced =
    parent.type.name === "element" && parents?.some((name) => sameName(name, parent.attrs.name));

  return parents && !isPlaced ? parents : null;
};
/** What's wrong with an element's place or content, for its gutter warning; the clean-up fixes it. */
const getElementIssue = (
  doc: ProseMirrorNode,
  pos: number,
  elementViews: ElementViews
): { message: string; cleanable: boolean } | null => {
  const name = doc.nodeAt(pos)?.attrs.name;
  const parents = getMisplacedParents(doc, pos, elementViews);
  const rejected = getRejectedChildren(doc, pos, elementViews).length;
  const blocks = rejected === 1 ? "1 block doesn't" : `${rejected} blocks don't`;

  if (parents) {
    return {
      message: `${name} belongs in ${PARENT_LIST.format(parents.map((parent) => `<${parent}>`))}.`,
      cleanable: true
    };
  }

  return rejected ? { message: `${blocks} belong in ${name}.`, cleanable: true } : null;
};
/**
 * All child blocks in the document that their elements' rules don't accept, see above, and the
 * elements outside the parents they may be in; with `ranges`, only in the top-level blocks they touch.
 */
const countRejectedChildren = (
  doc: ProseMirrorNode,
  elementViews: ElementViews,
  typing = false,
  ranges?: ChangedRange[]
): number => {
  let count = 0;

  doc.descendants((node, pos, parent) => {
    const isTouched =
      !ranges ||
      parent !== doc ||
      ranges.some(({ from, to }) => pos <= to && pos + node.nodeSize >= from);

    if (!isTouched) return false;
    if (node.type.name !== "element") return;

    count += getRejectedChildren(doc, pos, elementViews, typing).length;

    if (getMisplacedParents(doc, pos, elementViews)) count += 1;
  });

  return count;
};
/**
 * The ranges that a transaction changed, in the document before it and after it; null when a step
 * has no ranges, e.g. an attribute change, so the whole document is checked.
 */
const getChangedRanges = (
  tr: Transaction
): { before: ChangedRange[]; after: ChangedRange[] } | null => {
  const before: ChangedRange[] = [];
  const after: ChangedRange[] = [];

  let isMapped = true;

  tr.mapping.maps.forEach((map, index) => {
    const toStart = tr.mapping.slice(0, index).invert();
    const toEnd = tr.mapping.slice(index + 1);

    let hasRanges = false;

    map.forEach((oldStart, oldEnd, newStart, newEnd) => {
      hasRanges = true;
      before.push({ from: toStart.map(oldStart, -1), to: toStart.map(oldEnd, 1) });
      after.push({ from: toEnd.map(newStart, -1), to: toEnd.map(newEnd, 1) });
    });

    isMapped &&= hasRanges;
  });

  return isMapped ? { before, after } : null;
};
/**
 * Whether a transaction adds child blocks that their elements don't accept, or misplaced elements;
 * content that was already there stays. Only the top-level blocks that it changed are checked.
 */
const addsRejectedChildren = (
  tr: Transaction,
  elementViews: ElementViews,
  typing = false
): boolean => {
  const ranges = getChangedRanges(tr);
  const before = countRejectedChildren(tr.before, elementViews, typing, ranges?.before);

  return countRejectedChildren(tr.doc, elementViews, typing, ranges?.after) > before;
};
/** A new element with the blocks as its content, e.g. a `Tab` for paragraphs in `Tabs`. */
const createElement = (schema: Schema, wrapper: Wrapper, blocks: ProseMirrorNode[]) => {
  const source = formatElement({
    name: wrapper.name,
    props: (wrapper.description.props ?? {}) as Record<string, ElementValue>,
    selfClosing: false
  });
  const { name, props } = parseElement(source);

  return schema.nodes.element.create({ name, props, selfClosing: false, source }, blocks);
};
/**
 * Makes the element's content fit its rules: neighboring blocks that don't fit go into a new
 * accepted child that holds them, e.g. paragraphs in `Tabs` into a `Tab`; other blocks move to right
 * after the element. Empty paragraphs are removed. False if the element has no rules.
 */
const cleanUpElementContent = (
  tr: Transaction,
  pos: number,
  elementViews: ElementViews
): boolean => {
  const node = tr.doc.nodeAt(pos);
  const rules = getAccepts(tr.doc, pos, elementViews);
  const { schema } = tr.doc.type;
  const kept: ProseMirrorNode[] = [];
  const movedOut: ProseMirrorNode[] = [];

  let group: WrapGroup | null = null;

  if (!node || !rules) return false;

  const ancestors = [node.attrs.name, ...getElementAncestors(tr.doc, pos)];
  const wrappers = (rules.accepts?.elements ?? []).flatMap((name): Wrapper[] => {
    const description = elementViews.describe(name, ancestors);

    return description?.content ? [{ name, description }] : [];
  });
  const closeGroup = () => {
    if (group) kept.push(createElement(schema, group.wrapper, group.blocks));

    group = null;
  };

  node.forEach((child) => {
    const isEmptyParagraph = child.type.name === "paragraph" && !child.content.size;
    const wrapper = wrappers.find(({ description }) => {
      const wrapperRules = getRules(description);

      return !wrapperRules || acceptsBlock(wrapperRules, child);
    });

    if (acceptsBlock(rules, child)) {
      closeGroup();
      kept.push(child);

      return;
    }

    if (isEmptyParagraph) return;

    if (!wrapper) {
      closeGroup();
      movedOut.push(child);

      return;
    }

    if (group?.wrapper.name !== wrapper.name) {
      closeGroup();
      group = { wrapper, blocks: [] };
    }

    group!.blocks.push(child);
  });
  closeGroup();

  const end = pos + node.nodeSize;

  tr.insert(end, movedOut);
  tr.replaceWith(pos + 1, end - 1, kept.length ? kept : [schema.nodes.paragraph.create()]);

  return true;
};
/**
 * Puts a misplaced element, with its misplaced neighbors of the same root, into an allowed element
 * right before them, at its end, or right after them, at its start, e.g. a `Step` after `Steps`;
 * else wraps them in a new root, e.g. `Steps`. False if the element isn't misplaced.
 */
const cleanUpElementPlace = (tr: Transaction, pos: number, elementViews: ElementViews): boolean => {
  const parents = getMisplacedParents(tr.doc, pos, elementViews);
  const $pos = tr.doc.resolve(pos);
  const siblings: Array<{ node: ProseMirrorNode; pos: number }> = [];

  if (!parents) return false;

  const isAllowed = (node?: ProseMirrorNode) => {
    return node?.type.name === "element" && parents.some((name) => sameName(name, node.attrs.name));
  };
  const isInRun = ({ pos: siblingPos }: { pos: number }) => {
    const siblingParents = getMisplacedParents(tr.doc, siblingPos, elementViews);

    return Boolean(siblingParents?.some((name) => sameName(name, parents[0])));
  };
  // Only an empty paragraph: a placeholder that the moved elements take the place of.
  const hasPlaceholder = (node: ProseMirrorNode) => {
    return (
      node.childCount === 1 &&
      node.firstChild!.type.name === "paragraph" &&
      !node.firstChild!.content.size
    );
  };

  $pos.parent.forEach((node, offset) => siblings.push({ node, pos: $pos.start() + offset }));

  let first = $pos.index();
  let last = first;

  while (first > 0 && isInRun(siblings[first - 1])) first -= 1;
  while (last < siblings.length - 1 && isInRun(siblings[last + 1])) last += 1;

  const run = siblings.slice(first, last + 1).map(({ node }) => node);
  const from = siblings[first].pos;
  const to = siblings[last].pos + siblings[last].node.nodeSize;
  const before = siblings[first - 1];
  const after = siblings[last + 1];

  if (before && isAllowed(before.node)) {
    const end = before.pos + before.node.nodeSize - 1;

    tr.delete(from, to);
    tr.replaceWith(hasPlaceholder(before.node) ? before.pos + 1 : end, end, run);
  } else if (after && isAllowed(after.node)) {
    const start = after.pos + 1;
    const end = hasPlaceholder(after.node) ? after.pos + after.node.nodeSize - 1 : start;

    tr.replaceWith(start, end, run);
    tr.delete(from, to);
  } else {
    const ancestors = getElementAncestors(tr.doc, pos);
    const description = elementViews.describe(parents[0], ancestors) ?? {};
    const wrapper = { name: parents[0], description: description as ElementViewDescription };

    tr.replaceWith(from, to, createElement(tr.doc.type.schema, wrapper, run));
  }

  return true;
};

/**
 * Cleans up the element in one undoable transaction: its place if it's misplaced, else its
 * content; false if nothing changed.
 */
const cleanUpElement = (editor: Editor, pos: number, elementViews: ElementViews): boolean => {
  const tr = editor.state.tr;
  const isMisplaced = Boolean(getMisplacedParents(tr.doc, pos, elementViews));

  if (isMisplaced) {
    if (!cleanUpElementPlace(tr, pos, elementViews)) return false;
  } else {
    if (!getRejectedChildren(tr.doc, pos, elementViews).length) return false;
    if (!cleanUpElementContent(tr, pos, elementViews)) return false;
  }

  editor.view.dispatch(tr);

  return true;
};

export {
  acceptsBlock,
  addsRejectedChildren,
  acceptsType,
  cleanUpElement,
  cleanUpElementContent,
  getAccepts,
  getElementAncestors,
  getElementViews,
  getElementIssue,
  getMisplacedParents,
  getRejectedChildren
};
