import type { Editor, EditorEvents } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  BLOCK_CONTROL_PROXIMITY_RATIO,
  BLOCK_CONTROL_VIRTUAL_MARGIN_REM,
  LIST_ITEM_TYPES
} from "./constants";
import { getElementAncestors } from "#editor/lib/element-content";

interface BlockControlTarget {
  dom: HTMLElement;
  node: ProseMirrorNode;
  pos: number;
}
interface BlockControlRectCache {
  elements: WeakMap<HTMLElement, DOMRect>;
  fontSize?: number;
  layoutVersion: number;
  scrollContainer: HTMLElement | null;
  targets: WeakMap<HTMLElement, TargetRects>;
}

type BlockControlSide = "left" | "right";
type TargetRectName = "anchor" | "content" | "hover";
type TargetRects = Partial<Record<TargetRectName, DOMRect>>;

const caches = new WeakMap<Editor, BlockControlRectCache>();

const createCache = (editor: Editor): BlockControlRectCache => {
  const scrollContainer = editor.view.dom.closest<HTMLElement>(
    "[data-editor-scrollable-container]"
  );
  const cache: BlockControlRectCache = {
    elements: new WeakMap(),
    layoutVersion: 0,
    scrollContainer,
    targets: new WeakMap()
  };
  const invalidate = () => invalidateBlockControlLayout(editor);
  const onTransaction = ({ transaction }: EditorEvents["transaction"]) => {
    if (transaction.docChanged) invalidate();
  };
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(invalidate);
  const destroy = () => {
    observer?.disconnect();
    window.removeEventListener("resize", invalidate);
    window.removeEventListener("scroll", invalidate, true);
    editor.off("transaction", onTransaction);
    editor.off("destroy", destroy);
    caches.delete(editor);
  };

  observer?.observe(editor.view.dom);

  if (scrollContainer) observer?.observe(scrollContainer);

  window.addEventListener("resize", invalidate);
  window.addEventListener("scroll", invalidate, { passive: true, capture: true });
  editor.on("transaction", onTransaction);
  editor.on("destroy", destroy);

  return cache;
};

const getCache = (editor: Editor): BlockControlRectCache => {
  let cache = caches.get(editor);

  if (!cache) {
    cache = createCache(editor);
    caches.set(editor, cache);
  }

  return cache;
};

const getCachedElementRect = (editor: Editor, element: HTMLElement): DOMRect => {
  const cache = getCache(editor);

  let rect = cache.elements.get(element);

  if (!rect) {
    rect = element.getBoundingClientRect();
    cache.elements.set(element, rect);
  }

  return rect;
};
const invalidateBlockControlLayout = (editor: Editor): void => {
  const cache = getCache(editor);

  cache.elements = new WeakMap();
  cache.targets = new WeakMap();
  cache.fontSize = undefined;
  cache.layoutVersion += 1;
};

const getCachedTargetRect = (
  editor: Editor,
  target: BlockControlTarget,
  name: TargetRectName,
  measure: () => DOMRect
): DOMRect => {
  const cache = getCache(editor);
  const targetRects = cache.targets.get(target.dom) || {};

  let rect = targetRects[name];

  if (!rect) {
    rect = measure();
    targetRects[name] = rect;
    cache.targets.set(target.dom, targetRects);
  }

  return rect;
};

const getEditorScrollContainer = (editor: Editor): HTMLElement | null => {
  return getCache(editor).scrollContainer;
};
const getBlockControlLayoutVersion = (editor: Editor): number => {
  return getCache(editor).layoutVersion;
};

const getTargetList = (target: BlockControlTarget): HTMLElement | null => {
  const parent = LIST_ITEM_TYPES.has(target.node.type.name) ? target.dom.parentElement : null;

  return parent?.matches("ul, ol") ? parent : null;
};

/** A block in an element view's content or UI, e.g. a card in a grid; its controls are in the gutter. */
const isElementViewChild = (target: BlockControlTarget): boolean => {
  return Boolean(target.dom.parentElement?.closest("[data-element-view]"));
};
/** A block inside an element, in its view or between its tags; its controls are in the gutter. */
const isInElement = (editor: Editor, target: BlockControlTarget): boolean => {
  return getElementAncestors(editor.state.doc, target.pos).length > 0;
};
/** A block's UI in a view, e.g. a tab in a tab bar, from a `BlockArea`. */
const isBlockArea = (target: BlockControlTarget): boolean => {
  return Boolean(target.dom.parentElement?.dataset.blockArea);
};
/** The top-level block around the target, e.g. the card grid around a card. */
const getTopLevelRect = (editor: Editor, target: BlockControlTarget): DOMRect => {
  const $pos = editor.state.doc.resolve(target.pos);
  const dom = editor.view.nodeDOM($pos.depth ? $pos.before(1) : target.pos);

  return getCachedElementRect(editor, dom instanceof HTMLElement ? dom : target.dom);
};
const getFirstLineRect = (editor: Editor, element: HTMLElement): DOMRect => {
  const elementRect = getCachedElementRect(editor, element);
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const caret = node.parentElement?.closest(
        ".collaboration-caret, .collaboration-caret__label"
      );

      return node.textContent?.trim() && !caret
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  const text = walker.nextNode();

  if (text?.textContent) {
    const range = document.createRange();

    range.setStart(text, 0);
    range.setEnd(text, Math.min(1, text.textContent.length));

    const rect = range.getClientRects()[0];

    if (rect) return new DOMRect(rect.x, rect.y, rect.width, rect.height);
  }

  const style = window.getComputedStyle(element);
  const parsedLineHeight = Number.parseFloat(style.lineHeight);

  return new DOMRect(
    elementRect.x,
    elementRect.y + (Number.parseFloat(style.paddingTop) || 0),
    elementRect.width,
    Number.isNaN(parsedLineHeight) ? 24 : parsedLineHeight
  );
};

const getBlockContentRect = (editor: Editor, target: BlockControlTarget): DOMRect => {
  return getCachedTargetRect(editor, target, "content", () => {
    const outerRect = getCachedElementRect(editor, target.dom);
    const customAnchor = target.dom.querySelector<HTMLElement>("[data-block-control-anchor]");

    if (customAnchor) return getCachedElementRect(editor, customAnchor);

    if (target.node.type.name === "horizontalRule") {
      const line = target.dom.matches("hr") ? target.dom : target.dom.querySelector("hr");

      return line instanceof HTMLElement ? getCachedElementRect(editor, line) : outerRect;
    }

    let textblockPos: number | null = target.node.isTextblock ? target.pos : null;

    target.node.descendants((node, pos) => {
      if (textblockPos !== null || !node.isTextblock) return textblockPos === null;

      textblockPos = target.pos + 1 + pos;
      return false;
    });

    const textblock = textblockPos === null ? null : editor.view.nodeDOM(textblockPos);

    return textblock instanceof HTMLElement ? getFirstLineRect(editor, textblock) : outerRect;
  });
};

const getBlockControlAnchorRect = (editor: Editor, target: BlockControlTarget): DOMRect => {
  return getCachedTargetRect(editor, target, "anchor", () => {
    const isElement = target.node.type.name === "element";
    const tag = isElement
      ? target.dom.querySelector<HTMLElement>(':scope > [data-element-tag="opening"]')
      : null;
    const block = getCachedElementRect(editor, target.dom);
    // While a view hides the tag: the element's top line, where its gutter markers are.
    const topLine = new DOMRect(block.x, block.y, block.width, Math.min(block.height, 32));
    // An area's top line too, e.g. a step's, which spans the step.
    const content = isBlockArea(target)
      ? topLine
      : tag && !tag.hidden
        ? getCachedElementRect(editor, tag)
        : isElement
          ? topLine
          : getBlockContentRect(editor, target);
    // The editor's content box: the controls are in its gutters, at the same X for every block.
    const horizontal = getCachedElementRect(editor, editor.view.dom);

    return new DOMRect(horizontal.x, content.y, horizontal.width, Math.max(1, content.height));
  });
};

const getElementContentRect = (editor: Editor, content: HTMLElement): DOMRect => {
  const rect = getCachedElementRect(editor, content);
  const opening = content.parentElement?.querySelector<HTMLElement>(
    ':scope > [data-element-tag="opening"]'
  );
  const closing = content.parentElement?.querySelector<HTMLElement>(
    ':scope > [data-element-tag="closing"]'
  );

  if (!opening || !closing || closing.hidden) return rect;

  const top = getCachedElementRect(editor, opening).bottom;
  const bottom = getCachedElementRect(editor, closing).top;

  return new DOMRect(rect.x, top, rect.width, Math.max(0, bottom - top));
};

const getBlockControlHoverRect = (editor: Editor, target: BlockControlTarget): DOMRect => {
  return getCachedTargetRect(editor, target, "hover", () => {
    const block = getCachedElementRect(editor, target.dom);
    const list = getTargetList(target);
    const $position = editor.state.doc.resolve(target.pos);
    let vertical = list ? getCachedElementRect(editor, list) : block;
    let horizontal =
      target.node.type.name === "codeBlock" ? getBlockControlAnchorRect(editor, target) : block;

    const content = target.dom.parentElement;
    const isViewChild = isElementViewChild(target);
    // In a view, its slot's box, with its padding, e.g. an accordion's; a slot with `contents`,
    // e.g. a grid's, has none.
    const isContentBlock = Boolean(content?.matches("[data-element-content]"));
    const slotBox = isViewChild && isContentBlock ? content!.parentElement?.parentElement : null;
    const slotRect = slotBox ? getCachedElementRect(editor, slotBox) : null;
    const hasContentBox = isContentBlock && (!isViewChild || Boolean(slotRect?.height));

    if (isInElement(editor, target)) horizontal = getTopLevelRect(editor, target);

    if ($position.parent.type.name === "element" && hasContentBox) {
      const previous = $position.nodeBefore;
      const nextPosition = target.pos + target.node.nodeSize;
      const previousDOM = previous ? editor.view.nodeDOM(target.pos - previous.nodeSize) : null;
      const nextDOM = nextPosition < $position.end() ? editor.view.nodeDOM(nextPosition) : null;
      const contentRect = slotRect ?? getElementContentRect(editor, content!);
      const top =
        previousDOM instanceof HTMLElement
          ? getCachedElementRect(editor, previousDOM).bottom
          : contentRect.top;
      const bottom =
        nextDOM instanceof HTMLElement
          ? getCachedElementRect(editor, nextDOM).top
          : contentRect.bottom;

      vertical = new DOMRect(
        block.x,
        Math.min(top, block.top),
        block.width,
        Math.max(bottom, block.bottom) - Math.min(top, block.top)
      );
    }

    if (list) {
      const $pos = editor.state.doc.resolve(target.pos);
      const topLevelDOM = editor.view.nodeDOM($pos.depth ? $pos.before(1) : target.pos);

      if (topLevelDOM instanceof HTMLElement) {
        horizontal = getCachedElementRect(editor, topLevelDOM);
      }
    }

    const scrollContainer = getEditorScrollContainer(editor);

    if (!scrollContainer) {
      return new DOMRect(horizontal.left, vertical.top, horizontal.width, vertical.height);
    }

    const cache = getCache(editor);
    const scroll = getCachedElementRect(editor, scrollContainer);

    cache.fontSize ??=
      Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

    const margin = BLOCK_CONTROL_VIRTUAL_MARGIN_REM * cache.fontSize;
    const left = Math.min(margin, Math.max(0, horizontal.left - scroll.left));
    const right = Math.min(margin, Math.max(0, scroll.right - horizontal.right));

    return new DOMRect(
      horizontal.left - left,
      vertical.top,
      horizontal.width + left + right,
      vertical.height
    );
  });
};

const isPointInBlockControlArea = (
  editor: Editor,
  target: BlockControlTarget,
  { x, y, side }: { x: number; y: number; side?: BlockControlSide }
): boolean => {
  const hover = getBlockControlHoverRect(editor, target);

  if (x < hover.left || x > hover.right || y < hover.top || y > hover.bottom) return false;
  if (!side) return true;

  const nodeDOM = editor.view.nodeDOM(target.pos);
  // An area in its block's own box, e.g. a step's badge, by that box, as the block's other parts.
  const isAreaInBlock =
    isBlockArea(target) && nodeDOM instanceof HTMLElement && nodeDOM.contains(target.dom);
  // A view child's own box, not the gutter-aligned anchor, e.g. the left part of a card.
  const block = isAreaInBlock
    ? getCachedElementRect(editor, nodeDOM)
    : isElementViewChild(target)
      ? getCachedElementRect(editor, target.dom)
      : getBlockControlAnchorRect(editor, target);
  const threshold = block.width * BLOCK_CONTROL_PROXIMITY_RATIO;

  return side === "left" ? x <= block.left + threshold : x >= block.right - threshold;
};
/** The distance from the point to the rect; zero inside it. */
const getRectDistance = (rect: DOMRect, x: number, y: number): number => {
  return Math.hypot(
    Math.max(rect.left - x, x - rect.right, 0),
    Math.max(rect.top - y, y - rect.bottom, 0)
  );
};

export {
  getBlockContentRect,
  getBlockControlAnchorRect,
  getBlockControlHoverRect,
  getBlockControlLayoutVersion,
  getCachedElementRect,
  getElementContentRect,
  getEditorScrollContainer,
  getRectDistance,
  invalidateBlockControlLayout,
  isElementViewChild,
  isPointInBlockControlArea
};
export type { BlockControlSide, BlockControlTarget };
