import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getCachedElementRect, getRectDistance } from "./block-control-sizing";
import { acceptsBlock, getAccepts, getElementViews } from "#editor/lib/element-content";

interface DropSlot {
  /** Where the dragged blocks go. */
  pos: number;
  /** The block whose place they take, or the element they go into. */
  target: number;
}
interface SlotArea {
  pos: number;
  node: ProseMirrorNode;
  append: boolean;
  rect: DOMRect;
}
interface SlotGroup {
  /** The element that the areas' blocks are in, or that an `append` area adds to. */
  parent: number;
  region: DOMRect;
  areas: SlotArea[];
}

const blockPositions = new WeakMap<ProseMirrorNode, Map<string, number>>();

const getBlockPositions = (doc: ProseMirrorNode): Map<string, number> => {
  let positions = blockPositions.get(doc);

  if (!positions) {
    positions = new Map();
    doc.descendants((node, pos) => {
      if (node.attrs.id) positions!.set(node.attrs.id, pos);
    });
    blockPositions.set(doc, positions);
  }

  return positions;
};
/** Droppable areas, by the element that their blocks are in; its view box is their region. */
const getSlotGroups = (editor: Editor): SlotGroup[] => {
  const { state, dom } = editor.view;
  const positions = getBlockPositions(state.doc);
  const groups = new Map<number, SlotGroup>();

  dom
    .querySelectorAll<HTMLElement>("[data-block-area][data-block-droppable]")
    .forEach((element) => {
      const area = element.firstElementChild;
      const pos = positions.get(element.dataset.blockArea!);
      const node = pos === undefined ? null : state.doc.nodeAt(pos);

      if (!(area instanceof HTMLElement) || pos === undefined || !node) return;

      const $pos = state.doc.resolve(pos);
      const append = element.dataset.blockDroppable === "append";
      const parent = append ? pos : $pos.depth ? $pos.before($pos.depth) : -1;
      const parentDOM = parent < 0 ? null : editor.view.nodeDOM(parent);
      const blockDOM = editor.view.nodeDOM(pos);
      // The block's box when the area is in it, e.g. a card's title; else the area's, e.g. a tab.
      const isInBlock = !append && blockDOM instanceof HTMLElement && blockDOM.contains(area);
      const rect = getCachedElementRect(editor, isInBlock ? (blockDOM as HTMLElement) : area);

      if (!(parentDOM instanceof HTMLElement) || !rect.width) return;

      const group = groups.get(parent) ?? {
        parent,
        region: getCachedElementRect(editor, parentDOM),
        areas: []
      };

      group.areas.push({ pos, node, append, rect });
      groups.set(parent, group);
    });

  return [...groups.values()];
};
/** Whether the element's content rules take the dragged blocks, e.g. no paragraph in `Steps`. */
const takesDragged = (editor: Editor, parent: number): boolean => {
  const { state, dragging } = editor.view;
  const elementViews = getElementViews(editor);
  const rules = elementViews ? getAccepts(state.doc, parent, elementViews) : null;
  const blocks: ProseMirrorNode[] = [];

  dragging?.slice.content.forEach((block) => blocks.push(block));

  return !rules || blocks.every((block) => acceptsBlock(rules, block));
};
/**
 * Where the editor's drag drops among droppable `BlockArea`s: in the innermost region with the
 * point, the nearest area's block takes the dragged blocks' place: after it when they move forward
 * in the same element, else before it; an `append` area takes them at the end of its content.
 * A group of only `append` areas, e.g. folder rows, applies only over them, so the editor's own
 * drop positions apply between, e.g. between a folder's rows. Null for no move, e.g. over the
 * dragged block; undefined outside regions, or where the element doesn't take the dragged blocks,
 * e.g. a paragraph over steps, which can go into a step.
 */
const getDropSlot = (
  editor: Editor,
  { left, top }: { left: number; top: number }
): DropSlot | null | undefined => {
  const { state, dragging } = editor.view;
  const contains = (rect: DOMRect) => {
    return left >= rect.left && left <= rect.right && top >= rect.top && top <= rect.bottom;
  };
  const distance = (rect: DOMRect) => getRectDistance(rect, left, top);
  const size = (rect: DOMRect) => rect.width * rect.height;
  const group =
    dragging?.slice &&
    getSlotGroups(editor)
      .filter(({ region, parent, areas }) => {
        const isAppendOnly = areas.every(({ append }) => append);
        const isOverArea = areas.some(({ rect }) => contains(rect));

        return contains(region) && (!isAppendOnly || isOverArea) && takesDragged(editor, parent);
      })
      .sort((first, second) => size(first.region) - size(second.region))[0];

  if (!dragging || !group) return undefined;

  const nearest = group.areas.reduce((previous, area) => {
    return distance(area.rect) < distance(previous.rect) ? area : previous;
  });
  const { from, to } = state.selection;
  const end = nearest.pos + nearest.node.nodeSize;
  const $from = state.doc.resolve(from);
  const $target = state.doc.resolve(nearest.pos);
  const isSameParent = $from.depth === $target.depth && $from.before() === $target.before();
  const isDragged = dragging.move && from <= nearest.pos && end <= to;
  const isForward = dragging.move && isSameParent && to <= nearest.pos;
  const isAlreadyLast = dragging.move && to === end - 1;

  if (nearest.append) return isAlreadyLast ? null : { pos: end - 1, target: nearest.pos };
  if (isDragged) return null;

  return { pos: isForward ? end : nearest.pos, target: nearest.pos };
};

export { getBlockPositions, getDropSlot };
export type { DropSlot };
