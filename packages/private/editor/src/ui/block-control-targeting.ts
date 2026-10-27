import {
  isBlockSelection,
  isFragmentChildBlockSelection
} from "#editor/extensions/block-selection";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { forEachSelectedBlock, selectionCoversNode } from "./block-utils";
import {
  getBlockControlAnchorRect,
  getBlockControlHoverRect,
  getBlockControlLayoutVersion,
  getCachedElementRect,
  getEditorScrollContainer,
  isElementViewChild,
  isPointInBlockControlArea,
  type BlockControlSide,
  type BlockControlTarget
} from "./block-control-sizing";
import { BLOCK_CONTROL_PROXIMITY_RATIO, LIST_ITEM_TYPES } from "./constants";
import { createElementChildTargetResolver } from "./element-child-target";
import { getContentAtPoint, getViewTargetAtPoint } from "./element-view-target";

interface BlockControlRange {
  from: number;
  to: number;
}
interface BlockControlHit {
  insideFragment: boolean;
  target: BlockControlTarget | null;
  /** The target is from an element view's DOM, so it isn't guessed from the line. */
  inView?: boolean;
}
interface BlockSelectionBounds {
  blockLeft: number;
  blockRight: number;
  bottom: number;
  left: number;
  right: number;
  top: number;
}
interface BlockSelectionTargetCache {
  bounds?: BlockSelectionBounds;
  doc: ProseMirrorNode;
  from: number;
  layoutVersion: number;
  targets: BlockControlTarget[];
  to: number;
}

const blockSelectionTargetCaches = new WeakMap<Editor, BlockSelectionTargetCache>();
const elementChildTargetResolvers = new WeakMap<
  Editor,
  Map<boolean, ReturnType<typeof createElementChildTargetResolver>>
>();

const getBlockControlTargetAtPos = (editor: Editor, pos: number): BlockControlTarget | null => {
  if (pos < 0) return null;

  const node = editor.state.doc.nodeAt(pos);
  const dom = node ? editor.view.nodeDOM(pos) : null;

  return node && node.type.name !== "title" && dom instanceof HTMLElement
    ? { dom, node, pos }
    : null;
};

const getNodeViewTarget = (
  editor: Editor,
  dom: HTMLElement,
  type: "fragment" | "property" | "image" | "element"
): BlockControlTarget | null => {
  const { state, view } = editor;

  try {
    const domPos = view.posAtDOM(dom, 0);
    const directTarget = getBlockControlTargetAtPos(editor, domPos);

    if (directTarget?.node.type.name === type && directTarget.dom === dom) return directTarget;

    const $pos = state.doc.resolve(domPos);

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === type) {
        const target = getBlockControlTargetAtPos(editor, $pos.before(depth));

        if (target?.dom === dom) return target;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const getStructureHitAtPoint = (editor: Editor, x: number, y: number): BlockControlHit => {
  const elements = editor.view.root.elementsFromPoint(x, y);
  let fragmentDOM: HTMLElement | null = null;
  let insideFragment = false;
  let propertyDOM: HTMLElement | null = null;
  let elementDOM: HTMLElement | null = null;
  let imageDOM: HTMLElement | null = null;

  elements.forEach((element) => {
    const fragment = element.closest<HTMLElement>("[data-fragment-node-view]");

    insideFragment ||= Boolean(fragment);

    if (!fragmentDOM && fragment && element.closest("[data-fragment-header]")) {
      fragmentDOM = fragment;
    }

    propertyDOM ||= element.closest<HTMLElement>("[data-property-node-view]");
    imageDOM ||= element.closest<HTMLElement>("[data-image-node-view]");
    if (!elementDOM && element.closest("[data-element-tag]"))
      elementDOM = element.closest<HTMLElement>("[data-element-node-view]");
  });

  if (fragmentDOM) {
    return {
      insideFragment,
      target: getNodeViewTarget(editor, fragmentDOM, "fragment")
    };
  }

  if (elementDOM)
    return { insideFragment, target: getNodeViewTarget(editor, elementDOM, "element") };

  if (imageDOM) {
    return { insideFragment, target: getNodeViewTarget(editor, imageDOM, "image") };
  }

  return {
    insideFragment,
    target: propertyDOM ? getNodeViewTarget(editor, propertyDOM, "property") : null
  };
};
const getBlockSelectionTargetCache = (editor: Editor): BlockSelectionTargetCache | null => {
  const { doc, selection } = editor.state;

  if (!isBlockSelection(selection)) return null;

  const layoutVersion = getBlockControlLayoutVersion(editor);
  const cached = blockSelectionTargetCaches.get(editor);

  if (cached?.doc === doc && cached.from === selection.from && cached.to === selection.to) {
    if (cached.layoutVersion !== layoutVersion) {
      cached.bounds = undefined;
      cached.layoutVersion = layoutVersion;
    }

    return cached;
  }

  const targets: BlockControlTarget[] = [];

  forEachSelectedBlock(doc, selection.from, selection.to, (_node, pos) => {
    const target = getBlockControlTargetAtPos(editor, pos);

    if (target) targets.push(target);
  });

  const nextCache: BlockSelectionTargetCache = {
    doc,
    from: selection.from,
    layoutVersion,
    targets,
    to: selection.to
  };

  blockSelectionTargetCaches.set(editor, nextCache);

  return nextCache;
};
const getBlockSelectionBounds = (
  editor: Editor,
  cache: BlockSelectionTargetCache
): BlockSelectionBounds => {
  if (cache.bounds) return cache.bounds;

  const bounds: BlockSelectionBounds = {
    blockLeft: Number.POSITIVE_INFINITY,
    blockRight: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
    left: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    top: Number.POSITIVE_INFINITY
  };

  cache.targets.forEach((target) => {
    const rect = getBlockControlHoverRect(editor, target);
    const block = getBlockControlAnchorRect(editor, target);

    bounds.left = Math.min(bounds.left, rect.left);
    bounds.right = Math.max(bounds.right, rect.right);
    bounds.top = Math.min(bounds.top, rect.top);
    bounds.bottom = Math.max(bounds.bottom, rect.bottom);
    bounds.blockLeft = Math.min(bounds.blockLeft, block.left);
    bounds.blockRight = Math.max(bounds.blockRight, block.right);
  });
  cache.bounds = bounds;

  return bounds;
};

const getBlockSelectionTopTarget = (editor: Editor): BlockControlTarget | null => {
  return getBlockSelectionTargetCache(editor)?.targets[0] ?? null;
};

const isTargetInBlockSelection = (editor: Editor, target: BlockControlTarget): boolean => {
  const { selection } = editor.state;

  if (!isBlockSelection(selection)) return false;
  if (target.node.type.name === "element")
    return selection.from <= target.pos && selection.to >= target.pos + target.node.nodeSize;

  if (target.node.type.name === "fragment") {
    if (isFragmentChildBlockSelection(selection)) return false;

    return selectionCoversNode(target.node, target.pos, selection.from, selection.to);
  }

  return target.pos < selection.to && target.pos + target.node.nodeSize > selection.from;
};

const isPointInBlockSelectionControlArea = (
  editor: Editor,
  { x, y, side }: { x: number; y: number; side?: BlockControlSide }
): boolean => {
  const cache = getBlockSelectionTargetCache(editor);

  if (!cache?.targets.length) return false;

  const { blockLeft, blockRight, bottom, left, right, top } = getBlockSelectionBounds(
    editor,
    cache
  );

  if (x < left || x > right || y < top || y > bottom) return false;
  if (!side) return true;

  const threshold = (blockRight - blockLeft) * BLOCK_CONTROL_PROXIMITY_RATIO;

  return side === "left" ? x <= blockLeft + threshold : x >= blockRight - threshold;
};

const registerSelectionControlHiding = (editor: Editor, hideControls: () => void): (() => void) => {
  const element = editor.view.dom;

  let keyboardInput = false;

  const setKeyboardInput = () => (keyboardInput = true);
  const clearKeyboardInput = () => (keyboardInput = false);
  const handleSelectionUpdate = () => {
    const shouldHide = keyboardInput;

    keyboardInput = false;
    if (shouldHide) hideControls();
  };

  element.addEventListener("keydown", setKeyboardInput, true);
  element.addEventListener("keyup", clearKeyboardInput, true);
  element.addEventListener("blur", clearKeyboardInput, true);
  element.addEventListener("pointerdown", clearKeyboardInput, true);
  editor.on("selectionUpdate", handleSelectionUpdate);

  return () => {
    element.removeEventListener("keydown", setKeyboardInput, true);
    element.removeEventListener("keyup", clearKeyboardInput, true);
    element.removeEventListener("blur", clearKeyboardInput, true);
    element.removeEventListener("pointerdown", clearKeyboardInput, true);
    editor.off("selectionUpdate", handleSelectionUpdate);
  };
};

const getBlockControlHitAtY = (
  editor: Editor,
  y: number,
  { listItemSpecific = true, x: pointerX }: { listItemSpecific?: boolean; x?: number } = {}
): BlockControlHit => {
  const { state, view } = editor;
  const editorRect = getCachedElementRect(editor, view.dom);
  const x = editorRect.x + editorRect.width / 2;
  // At the pointer, or on the line's center while the pointer is in the gutter.
  const isInContent = pointerX !== undefined && Boolean(getContentAtPoint(editor, pointerX, y));
  const viewTarget = getViewTargetAtPoint(editor, isInContent ? pointerX! : x, y, listItemSpecific);

  if (viewTarget !== undefined) return { insideFragment: false, target: viewTarget, inView: true };

  const structureHit = getStructureHitAtPoint(editor, x, y);

  if (structureHit.target) return structureHit;

  const position = view.posAtCoords({ left: x, top: y });

  if (!position) return structureHit;

  const $pos = state.doc.resolve(position.pos);

  if (!listItemSpecific) {
    for (let depth = $pos.depth; depth > 1; depth -= 1) {
      if ($pos.node(depth - 1).type.name === "element")
        return { ...structureHit, target: getBlockControlTargetAtPos(editor, $pos.before(depth)) };
    }
    const pos = $pos.depth ? $pos.before(1) : position.inside >= 0 ? position.inside : $pos.pos;

    return { ...structureHit, target: getBlockControlTargetAtPos(editor, pos) };
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (LIST_ITEM_TYPES.has($pos.node(depth).type.name)) {
      return {
        ...structureHit,
        target: getBlockControlTargetAtPos(editor, $pos.before(depth))
      };
    }
  }

  // A fragment header controls the complete fragment. Its content keeps
  // individual block controls for direct children.
  for (let depth = $pos.depth; depth > 1; depth -= 1) {
    if (["fragment", "element"].includes($pos.node(depth - 1).type.name)) {
      return {
        ...structureHit,
        target: getBlockControlTargetAtPos(editor, $pos.before(depth))
      };
    }
  }

  // Gaps inside a fragment do not control the fragment. Only its header does.
  if ($pos.depth > 0 && $pos.node(1).type.name === "fragment") return structureHit;

  // Non-list content belongs to its top-level block, including blockquotes.
  for (const pos of [$pos.depth ? $pos.before(1) : -1, position.inside, $pos.pos]) {
    const target = getBlockControlTargetAtPos(editor, pos);

    if (target) return { ...structureHit, target };
  }

  return structureHit;
};
const getBlockControlTargetAtY = (
  editor: Editor,
  y: number,
  options?: { listItemSpecific?: boolean; x?: number }
): BlockControlTarget | null => {
  const listItemSpecific = options?.listItemSpecific ?? true;
  const resolvers =
    elementChildTargetResolvers.get(editor) ||
    new Map<boolean, ReturnType<typeof createElementChildTargetResolver>>();
  const resolve = resolvers.get(listItemSpecific) || createElementChildTargetResolver(editor);

  resolvers.set(listItemSpecific, resolve);
  elementChildTargetResolvers.set(editor, resolvers);
  const hit = getBlockControlHitAtY(editor, y, options);

  return hit.inView ? hit.target : resolve(hit.target, y);
};
/**
 * Whether a view child keeps the controls while the pointer goes out to them, e.g. from the second
 * card in a row over the first one to the gutter: beside the target, moving away from it, or out of
 * the content.
 */
const keepsViewChildTarget = (
  editor: Editor,
  target: BlockControlTarget | null,
  pointer: { x: number; y: number; previousX: number },
  side: BlockControlSide
): boolean => {
  if (!target?.dom.isConnected || !isElementViewChild(target)) return false;

  const rect = getCachedElementRect(editor, target.dom);
  // The top-level block's edges, where the controls are.
  const content = getBlockControlAnchorRect(editor, target);
  const isBeside = pointer.y >= rect.top && pointer.y <= rect.bottom;
  const isOutward =
    side === "left"
      ? pointer.x < rect.left && (pointer.x < pointer.previousX || pointer.x < content.left)
      : pointer.x > rect.right && (pointer.x > pointer.previousX || pointer.x > content.right);

  return isBeside && isOutward;
};

export {
  getBlockControlAnchorRect,
  getBlockControlHitAtY,
  getBlockSelectionTopTarget,
  getBlockControlTargetAtY,
  getCachedElementRect,
  getEditorScrollContainer,
  isPointInBlockSelectionControlArea,
  isPointInBlockControlArea,
  isTargetInBlockSelection,
  keepsViewChildTarget,
  registerSelectionControlHiding
};
export type { BlockControlSide, BlockControlTarget, BlockControlRange };
