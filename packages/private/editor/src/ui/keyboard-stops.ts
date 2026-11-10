import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { OPEN_BLOCK_MENU_META } from "#editor/ui/constants";

interface KeyboardStop {
  pos: number;
  node: ProseMirrorNode;
  /**
   * `text` takes the caret; `block` a block selection, e.g. a file row; `native` is the editor's
   * own, e.g. an image.
   */
  kind: "text" | "block" | "native";
}

const isShown = (element: unknown): element is HTMLElement => {
  return element instanceof HTMLElement && element.getClientRects().length > 0;
};
/** The IDs of the blocks with shown `BlockArea`s that match the selector, e.g. selectable ones. */
const getShownAreaIDs = (editor: Editor, selector: string): Set<string> => {
  const ids = new Set<string>();

  editor.view.dom.querySelectorAll<HTMLElement>(`[data-block-area]${selector}`).forEach((area) => {
    if (Array.from(area.children).some(isShown)) ids.add(area.dataset.blockArea!);
  });

  return ids;
};
/**
 * Where the arrow keys stop, in document order: blocks with their own selectable UI, e.g. a step,
 * before their shown text, and shown views without stops inside, e.g. an empty card grid.
 */
const getKeyboardStops = (editor: Editor): KeyboardStop[] => {
  const stops: KeyboardStop[] = [];
  // Blocks with their own selectable UI, e.g. a file row; not an "Add …" button for their content.
  const withOwnUI = getShownAreaIDs(
    editor,
    '[data-block-selectable]:not([data-block-droppable="append"])'
  );
  const visit = (node: ProseMirrorNode, pos: number) => {
    const dom = editor.view.nodeDOM(pos);
    const index = stops.length;
    const isElement = node.type.name === "element";

    // Before its text: e.g. a code group's tab, then its code.
    if (withOwnUI.has(node.attrs.id)) stops.push({ pos, node, kind: "block" });

    if (node.isTextblock) {
      if (isShown(dom)) stops.push({ pos, node, kind: "text" });

      return;
    }

    if (node.isAtom) {
      if (isShown(dom)) stops.push({ pos, node, kind: "native" });

      return;
    }

    node.forEach((child, offset) => visit(child, pos + 1 + offset));

    const view =
      dom instanceof HTMLElement ? dom.querySelector(":scope > [data-element-view]") : null;
    const isEmptyView = isElement && stops.length === index && isShown(view);

    if (isEmptyView) stops.push({ pos, node, kind: "block" });
  };

  editor.state.doc.forEach((node, offset) => visit(node, offset));

  return stops;
};
/**
 * The stop after or before the current one: the selected block's, or the caret's text block; else
 * the nearest one past its position, e.g. after a selected paragraph.
 */
const findNextStop = (
  editor: Editor,
  current: { pos: number; block: boolean },
  dir: 1 | -1
): KeyboardStop | null => {
  const stops = getKeyboardStops(editor);
  const { pos } = current;
  const index = stops.findIndex((stop) => {
    return stop.pos === pos && (current.block ? stop.kind !== "text" : stop.kind === "text");
  });

  if (index >= 0) return stops[index + dir] ?? null;

  return dir > 0
    ? (stops.find((stop) => stop.pos > pos) ?? null)
    : (stops.findLast((stop) => stop.pos < pos) ?? null);
};

/** Activates the block's shown UI by the view's `onActivate`, e.g. a tab button; false without. */
const activateBlock = (editor: Editor, node: ProseMirrorNode): boolean => {
  const id = CSS.escape((node.attrs.id as string | undefined) ?? "");
  const areas = editor.view.dom.querySelectorAll(`[data-block-area="${id}"][data-block-activate]`);
  const area = Array.from(areas).find((element) => Array.from(element.children).some(isShown));

  area?.dispatchEvent(new CustomEvent("block-activate"));

  return Boolean(area);
};
/** Whether the block at the position is a block stop, e.g. a file row, not a selected paragraph. */
const isBlockStop = (editor: Editor, pos: number): boolean => {
  return getKeyboardStops(editor).some((stop) => stop.pos === pos && stop.kind === "block");
};
/** The nearest shown text before the position, else after it, e.g. to leave a selected block. */
const findNearestText = (editor: Editor, pos: number): KeyboardStop | null => {
  const texts = getKeyboardStops(editor).filter(({ kind }) => kind === "text");

  return texts.findLast((stop) => stop.pos < pos) ?? texts.find((stop) => stop.pos > pos) ?? null;
};

/** Leaves the block for the nearest shown text: the end of one before, else a start after. */
const leaveBlock = (editor: Editor, pos: number): boolean => {
  const text = findNearestText(editor, pos);

  if (!text) return true;

  const textPos = text.pos < pos ? text.pos + text.node.nodeSize - 1 : text.pos + 1;

  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, textPos))
  );

  return true;
};
/** The one block that a block selection, or a node selection of a shown view, selects. */
const getSelectedBlock = (editor: Editor): { pos: number; node: ProseMirrorNode } | null => {
  const { selection } = editor.state;
  const dom = editor.view.nodeDOM(selection.from);
  const view =
    dom instanceof HTMLElement ? dom.querySelector(":scope > [data-element-view]") : null;
  const isViewNode = selection instanceof NodeSelection && isShown(view);
  const node = isBlockSelection(selection) || isViewNode ? selection.$from.nodeAfter : null;

  return node && selection.to === selection.from + node.nodeSize
    ? { pos: selection.from, node }
    : null;
};
/** Selects the stop: its block, the caret at its text's start or end by direction, or its node. */
const selectStop = (editor: Editor, stop: KeyboardStop, dir: 1 | -1): boolean => {
  const { doc } = editor.state;

  if (stop.kind === "block") {
    const range = { from: stop.pos, to: stop.pos + stop.node.nodeSize };
    const depth = doc.resolve(stop.pos).depth;

    return editor
      .chain()
      .setBlockSelection({ ...range, depth })
      .scrollIntoView()
      .run();
  }

  const textPos = dir > 0 ? stop.pos + 1 : stop.pos + stop.node.nodeSize - 1;
  const selection =
    stop.kind === "text" ? TextSelection.create(doc, textPos) : NodeSelection.create(doc, stop.pos);

  editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());

  return true;
};

/**
 * Enter or Space on a selected block stop, e.g. a tab reached with the arrow keys: the view's
 * `onActivate`; without it, Enter opens the block's menu. False for other keys and selections.
 */
const activateSelectedBlock = (editor: Editor, key: string): boolean => {
  const selected = getSelectedBlock(editor);
  const isActivation = key === "Enter" || key === " ";

  if (!selected || !isActivation || !isBlockStop(editor, selected.pos)) return false;
  if (activateBlock(editor, selected.node)) return true;
  if (key !== "Enter") return false;

  editor.view.dispatch(editor.state.tr.setMeta(OPEN_BLOCK_MENU_META, selected.pos));

  return true;
};

export { activateSelectedBlock, findNextStop, getSelectedBlock, isShown, leaveBlock, selectStop };
export type { KeyboardStop };
