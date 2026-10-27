import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  getCachedElementRect,
  getRectDistance,
  type BlockControlTarget
} from "./block-control-sizing";
import { getBlockPositions } from "./element-view-drop";
import { isShown } from "./keyboard-stops";
import { LIST_ITEM_TYPES } from "./constants";
import { getTargetForDOM } from "./element-child-target";

/** The editor content under the point, if it isn't the editor's own padding. */
const getContentAtPoint = (editor: Editor, x: number, y: number): HTMLElement | null => {
  const root = editor.view.dom;
  const element = editor.view.root
    .elementsFromPoint(x, y)
    .find((element) => root.contains(element));

  return element instanceof HTMLElement && element !== root ? element : null;
};
/** Whether a view's `ContentSlot` gives its blocks the drag handle and block menu. */
const hasControls = (content: Element | null): content is HTMLElement => {
  return Boolean(content?.parentElement?.matches("[data-content-slot][data-block-controls]"));
};
const getContentBlocks = (editor: Editor, content: HTMLElement) => {
  return Array.from(content.children)
    .filter((dom): dom is HTMLElement => dom instanceof HTMLElement)
    .map((dom) => ({ dom, rect: getCachedElementRect(editor, dom) }))
    .filter(({ rect }) => rect.height > 0);
};
/**
 * The content's block nearest the point; at a nested element's edge, its innermost block there,
 * e.g. a folder's last file.
 */
const getNearestBlock = (
  editor: Editor,
  content: HTMLElement,
  x: number,
  y: number
): BlockControlTarget | null => {
  const blocks = getContentBlocks(editor, content);
  const distance = (rect: DOMRect) => getRectDistance(rect, x, y);

  if (!blocks.length) return null;

  let { dom } = blocks.reduce((previous, block) => {
    return distance(block.rect) < distance(previous.rect) ? block : previous;
  });

  for (;;) {
    const nested = Array.from(dom.querySelectorAll<HTMLElement>("[data-element-content]")).find(
      (item) => item.closest("[data-element-node-view]") === dom
    );
    const inner =
      hasControls(nested ?? null) &&
      getContentBlocks(editor, nested!).find(({ rect }) => !distance(rect));

    if (!inner) break;

    dom = inner.dom;
  }

  return getTargetForDOM(editor, dom);
};
/** The nearest block when the point is in a gap between the content's blocks, e.g. file rows. */
const getBlockAtGap = (
  editor: Editor,
  content: HTMLElement,
  x: number,
  y: number
): BlockControlTarget | null => {
  const blocks = getContentBlocks(editor, content);
  const isBetweenBlocks =
    blocks.length > 1 && y >= blocks[0]!.rect.top && y <= blocks[blocks.length - 1]!.rect.bottom;

  return isBetweenBlocks ? getNearestBlock(editor, content, x, y) : null;
};
const getChildTargetByID = (
  editor: Editor,
  dom: HTMLElement,
  id: string
): BlockControlTarget | null => {
  const pos = getBlockPositions(editor.state.doc).get(id);
  const node = pos === undefined ? null : editor.state.doc.nodeAt(pos);

  return node ? { dom, node, pos: pos! } : null;
};
/**
 * The block under the point in an element view, from the view's DOM: the top-level block, unless
 * the view opts a block in: a block in a `ContentSlot` with `controls`, e.g. a tab's paragraph,
 * or a `BlockArea`'s block with the mode's option: `controls`, or `menu` for a right click; drops
 * use `controls` too. Undefined outside element views.
 */
const getViewTargetAtPoint = (
  editor: Editor,
  x: number,
  y: number,
  listItemSpecific: boolean,
  mode: "controls" | "drop" | "menu" = "controls"
): BlockControlTarget | null | undefined => {
  const root = editor.view.dom;
  const hit = getContentAtPoint(editor, x, y);

  if (!hit?.closest("[data-element-view]")) return undefined;

  // The area itself has `display: contents`, so the target is drawn by its child, e.g. a button.
  for (
    let dom: HTMLElement | null = hit, child = hit;
    dom && dom !== root;
    child = dom, dom = dom.parentElement
  ) {
    const isBlock = dom.parentElement === root || hasControls(dom.parentElement);
    const isArea =
      dom.dataset.blockArea &&
      dom.hasAttribute(mode === "menu" ? "data-block-menu" : "data-block-controls");
    const slotContent = dom.querySelector<HTMLElement>(
      ":scope > [data-content-slot][data-block-controls] > [data-element-content]"
    );
    const isListItem =
      listItemSpecific && dom.matches("li") && hasControls(dom.closest("[data-element-content]"));

    if (isArea) return getChildTargetByID(editor, child, dom.dataset.blockArea!);

    if (isListItem) {
      const item = getTargetForDOM(editor, dom);

      if (item && LIST_ITEM_TYPES.has(item.node.type.name)) return item;
    }

    if (hasControls(dom) && dom.matches("[data-element-content]")) {
      const block = getBlockAtGap(editor, dom, x, y);

      if (block) return block;
    }

    // A slot's own box, e.g. its padding, is its content's: the nearest block there.
    if (slotContent) {
      const block = getNearestBlock(editor, slotContent, x, y);

      if (block) return block;
    }

    if (isBlock) {
      const target = getTargetForDOM(editor, dom);

      if (target) return target;
    }
  }

  return null;
};
/**
 * Where a drag drops over an element view's UI, e.g. a file row: before or after the block there,
 * or, below the top of an element with content, e.g. a folder's row, at the start of its content.
 * Null over content, where the editor's own position applies.
 */
const getViewDropPosition = (
  editor: Editor,
  { left, top }: { left: number; top: number }
): { pos: number; inside: number } | null => {
  const hit = getContentAtPoint(editor, left, top);
  const view = hit?.closest("[data-element-view]");
  const content = hit?.closest("[data-element-content]");
  const target =
    view &&
    !(content && view.contains(content)) &&
    getViewTargetAtPoint(editor, left, top, false, "drop");

  if (!target) return null;

  const rect = getCachedElementRect(editor, target.dom);
  const nodeDOM = editor.view.nodeDOM(target.pos);
  // Only a child goes into its content, e.g. a folder; a top-level element's drops are around it.
  const nested =
    nodeDOM instanceof HTMLElement &&
    editor.state.doc.resolve(target.pos).depth > 0 &&
    Array.from(nodeDOM.querySelectorAll<HTMLElement>("[data-element-content]")).find(
      (item) => item.closest("[data-element-node-view]") === nodeDOM && item.children.length
    );
  const nestedRect = nested ? getCachedElementRect(editor, nested) : null;
  const contentTop = nestedRect?.top ?? rect.bottom;
  const isUpper = top < rect.top + (contentTop - rect.top) / 2;
  const isBelowContent = Boolean(nestedRect && top > nestedRect.bottom);
  const size = target.node.nodeSize;
  // Into the content: at its start above it, e.g. a folder's row, or at its end below it, e.g.
  // under a step's text.
  const contentEnd = isBelowContent ? target.pos + size - 1 : target.pos + 1;
  const end = nested ? contentEnd : target.pos + size;

  return { pos: isUpper ? target.pos : end, inside: -1 };
};

/**
 * The boxes of the UI that stands for the block: its innermost selectable areas, e.g. a folder's
 * row, not its area around the rows inside it. Each on its own, e.g. a header and a line below the
 * content, so the content between them isn't the block's UI.
 */
const getSelectableRects = (editor: Editor, node: ProseMirrorNode): DOMRect[] => {
  const areas = node.attrs.id
    ? Array.from(
        editor.view.dom.querySelectorAll(
          `[data-block-area="${CSS.escape(node.attrs.id)}"][data-block-selectable]`
        )
      )
    : [];
  const isInnermost = (area: Element) => {
    return !areas.some((other) => other !== area && area.contains(other));
  };

  return areas
    .filter(isInnermost)
    .flatMap((element) => Array.from(element.children))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width);
};
/**
 * The children of an element with a view that it opts in, with the boxes of their selectable UI,
 * and their own box where the content shows them without blocks of their own, e.g. a code group's
 * code block, which its tab button selects too.
 */
const getViewChildren = (editor: Editor, node: ProseMirrorNode, pos: number) => {
  const children: Array<{ child: ProseMirrorNode; pos: number; areas?: DOMRect[] }> = [];

  node.forEach((child, offset) => {
    const childPos = pos + 1 + offset;
    const dom = editor.view.nodeDOM(childPos);
    const isShownLeaf =
      (child.isTextblock || child.isAtom) &&
      dom instanceof HTMLElement &&
      hasControls(dom.parentElement) &&
      isShown(dom);
    const areas = getSelectableRects(editor, child);

    if (isShownLeaf) areas.push((dom as HTMLElement).getBoundingClientRect());

    if (areas.length) children.push({ child, pos: childPos, areas });
    else if (dom instanceof HTMLElement && hasControls(dom.parentElement)) {
      children.push({ child, pos: childPos });
    }
  });

  return children;
};

export {
  getContentAtPoint,
  getSelectableRects,
  getViewChildren,
  getViewDropPosition,
  getViewTargetAtPoint,
  hasControls
};
