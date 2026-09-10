import { invalidateBlockControlLayout } from "#editor/ui/block-control-sizing";
import { type Ref } from "@andesine/components";
import { type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { createSignal, createEffect, onCleanup, Show, type ParentComponent } from "solid-js";
import { Portal } from "solid-js/web";
import {
  createBlockRangeSelection,
  isBlockSelection,
  isFragmentChildBlockSelection,
  isSameBlockSelection
} from "#editor/extensions/block-selection";
import { createVerticalAutoScroll } from "#editor/ui/auto-scroll";
import { forEachSelectedBlock, isEditorBlock } from "#editor/ui/block-utils";
import { createBlockSelectionShade } from "./shade";
import {
  EMPTY_BOX_SELECTION,
  MARQUEE_ACTIVATION_THRESHOLD,
  MARQUEE_MARGIN
} from "#editor/ui/constants";

interface BlockSelectionProps {
  editor: Editor | null;
  scrollableContainerRef: Ref<HTMLElement | null>[0];
}
interface RectBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}
interface MarqueeNode {
  closingRect?: RectBounds;
  fragmentPos?: number;
  fragmentRoot?: boolean;
  pos: number;
  rect: RectBounds;
  size: number;
}

const BlockSelection: ParentComponent<BlockSelectionProps> = (props) => {
  const [pointerDown, setPointerDown] = createSignal(false);
  const [scrollableContainerRect, setScrollableContainerRect] = createSignal<DOMRect | null>(null);
  const [nodes, setNodes] = createSignal<MarqueeNode[]>([]);
  const [boxSelection, setBoxSelection] = createSignal(EMPTY_BOX_SELECTION);
  const updateSelection = (position: { clientX: number; clientY: number }) => {
    const editor = props.editor;
    const container = props.scrollableContainerRef();
    const containerRect = scrollableContainerRect();

    if (!editor || !pointerDown() || !container || !containerRect) return;

    const currentSelection = boxSelection();
    const localX = Math.max(
      0,
      Math.min(position.clientX - containerRect.left + container.scrollLeft, container.scrollWidth)
    );
    const localY = Math.max(
      MARQUEE_MARGIN,
      Math.min(
        position.clientY - containerRect.top + container.scrollTop,
        container.scrollHeight - MARQUEE_MARGIN
      )
    );
    const newBoxSelectionWidth = Math.abs(localX - currentSelection.x);
    const newBoxSelectionHeight = Math.abs(localY - currentSelection.y);
    const newBoxSelection = {
      ...currentSelection,
      active:
        currentSelection.active ||
        newBoxSelectionWidth > MARQUEE_ACTIVATION_THRESHOLD ||
        newBoxSelectionHeight > MARQUEE_ACTIVATION_THRESHOLD,
      currentX: localX,
      currentY: localY,
      width: newBoxSelectionWidth,
      height: newBoxSelectionHeight
    };

    setBoxSelection(newBoxSelection);

    if (!newBoxSelection.active) return;

    const selectionLeft = Math.min(newBoxSelection.x, newBoxSelection.currentX);
    const selectionRight = Math.max(newBoxSelection.x, newBoxSelection.currentX);
    const selectionTop = Math.min(newBoxSelection.y, newBoxSelection.currentY);
    const selectionBottom = Math.max(newBoxSelection.y, newBoxSelection.currentY);
    const marqueeNodes = nodes();
    const intersects = (rect: RectBounds): boolean => {
      return (
        rect.left < selectionRight &&
        rect.top < selectionBottom &&
        rect.right > selectionLeft &&
        rect.bottom > selectionTop
      );
    };
    const intersectsNode = (node: MarqueeNode) =>
      intersects(node.rect) || Boolean(node.closingRect && intersects(node.closingRect));
    const fullySelectedFragments = new Set<number>();
    const intersectedNodes = marqueeNodes.filter(intersectsNode);
    const directSelection = new Set(intersectedNodes.map((node) => node.pos));
    const firstHit = intersectedNodes[0]?.pos ?? Infinity;
    const lastHit = intersectedNodes.at(-1)?.pos ?? -Infinity;
    const childrenByPosition = new Map<number, MarqueeNode[]>();
    const nodesByPosition = new Map(marqueeNodes.map((node) => [node.pos, node]));

    for (const node of marqueeNodes) {
      if (node.fragmentPos === undefined) continue;
      const children = childrenByPosition.get(node.fragmentPos) || [];
      children.push(node);
      childrenByPosition.set(node.fragmentPos, children);
    }

    // Resolve nested containers from their children toward the document root.
    for (const node of [...marqueeNodes].reverse()) {
      if (!node.fragmentRoot) continue;
      const children = childrenByPosition.get(node.pos) || [];
      const selectedChildren = children.filter(
        (child) => directSelection.has(child.pos) || fullySelectedFragments.has(child.pos)
      ).length;
      const allChildrenSelected = children.length > 0 && selectedChildren === children.length;
      const crossesSelectionContext =
        selectedChildren > 0 && (firstHit < node.pos || lastHit >= node.pos + node.size);
      if (directSelection.has(node.pos) || allChildrenSelected || crossesSelectionContext)
        fullySelectedFragments.add(node.pos);
    }
    const selectedNodes = marqueeNodes.filter((node) => {
      let parentPosition = node.fragmentPos;
      while (parentPosition !== undefined) {
        if (fullySelectedFragments.has(parentPosition)) return false;
        parentPosition = nodesByPosition.get(parentPosition)?.fragmentPos;
      }
      return node.fragmentRoot
        ? fullySelectedFragments.has(node.pos)
        : directSelection.has(node.pos);
    });
    if (selectedNodes.length) {
      const firstNode = selectedNodes[0];
      const lastNode = selectedNodes[selectedNodes.length - 1];
      const fragmentPos = firstNode.fragmentPos;
      const selectsFragmentChildren =
        fragmentPos !== undefined &&
        selectedNodes.every((node) => node.fragmentPos === fragmentPos);
      const from = firstNode.pos;
      const to = lastNode.pos + lastNode.size;
      const position = {
        from,
        to,
        depth: selectsFragmentChildren ? editor.state.doc.resolve(from).depth : undefined
      };
      const selection = createBlockRangeSelection(editor.state.doc, position);
      const currentSelection = editor.state.selection;

      if (isSameBlockSelection(currentSelection, selection)) return;

      editor.chain().setBlockSelection(position).run();
    } else {
      const { inside = 0 } =
        editor.view.posAtCoords({
          left: newBoxSelection.x,
          top: newBoxSelection.y
        }) || {};

      const position = inside || 0;

      if (
        editor.state.selection instanceof TextSelection &&
        editor.state.selection.from === position
      ) {
        return;
      }

      editor.chain().setTextSelection(position).run();
    }
  };
  const autoScroll = createVerticalAutoScroll(
    () => props.scrollableContainerRef(),
    (position, offset) => {
      updateSelection({ ...position, clientY: position.clientY + offset });
    }
  );
  const onPointerDown = (event: PointerEvent) => {
    // Disable marquee block selection for touch devices
    if (event.pointerType === "touch") return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-menu]")) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-drag-handle]")) return;

    const editor = props.editor;

    if (!editor) return;

    const container = props.scrollableContainerRef();
    const pos = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY
    });

    if (pos || !container || event.button !== 0) return;

    const containerRect = container.getBoundingClientRect();
    const localX = Math.max(
      MARQUEE_MARGIN,
      Math.min(
        event.clientX - containerRect.left + container.scrollLeft,
        container.scrollWidth - MARQUEE_MARGIN
      )
    );
    const localY = Math.max(
      MARQUEE_MARGIN,
      Math.min(
        event.clientY - containerRect.top + container.scrollTop,
        container.scrollHeight - MARQUEE_MARGIN
      )
    );
    const boundingBoxes: MarqueeNode[] = [];

    document.documentElement.classList.add("select-none", "cursor-crosshair");
    setScrollableContainerRect(containerRect);
    setPointerDown(true);
    setBoxSelection({
      active: false,
      x: localX,
      y: localY,
      currentX: localX,
      currentY: localY,
      width: 0,
      height: 0
    });
    const toLocalRect = (rect: DOMRect): RectBounds => {
      return {
        bottom: rect.bottom - containerRect.y + container.scrollTop,
        left: rect.left - containerRect.x + container.scrollLeft,
        right: rect.right - containerRect.x + container.scrollLeft,
        top: rect.top - containerRect.y + container.scrollTop
      };
    };
    const addNode = (
      node: ProseMirrorNode,
      pos: number,
      options: Pick<MarqueeNode, "fragmentPos"> = {}
    ): MarqueeNode | null => {
      const dom = editor.view.nodeDOM(pos);

      if (dom instanceof HTMLElement) {
        const container =
          node.type.name === "fragment" ||
          (node.type.name === "element" && !node.attrs.selfClosing);
        const header = container
          ? dom.querySelector<HTMLElement>(
              node.type.name === "fragment"
                ? "[data-fragment-header]"
                : ':scope > [data-element-tag="opening"]'
            )
          : null;
        const closing =
          container && node.type.name === "element"
            ? dom.querySelector<HTMLElement>(':scope > [data-element-tag="closing"]')
            : null;
        const marqueeNode: MarqueeNode = {
          ...options,
          fragmentRoot: container,
          size: node.nodeSize,
          rect: toLocalRect((header || dom).getBoundingClientRect()),
          closingRect: closing ? toLocalRect(closing.getBoundingClientRect()) : undefined,
          pos
        };

        boundingBoxes.push(marqueeNode);
        if (container) {
          node.forEach((child, offset) => {
            if (isEditorBlock(child)) addNode(child, pos + 1 + offset, { fragmentPos: pos });
          });
        }
        return marqueeNode;
      }

      return null;
    };

    editor.state.doc.forEach((node, pos) => {
      if (node.attrs.inherited) return;
      if (node.type.name !== "title" && !isEditorBlock(node)) return;

      addNode(node, pos);
    });
    setNodes(boundingBoxes);
    editor.chain().setTextSelection(0).run();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!pointerDown()) return;

    autoScroll.update(event);
    updateSelection(event);
  };
  const onPointerEnd = () => {
    const editor = props.editor;

    setPointerDown(false);
    autoScroll.stop();
    document.documentElement.classList.remove("select-none", "cursor-crosshair");

    if (boxSelection().active && editor) {
      setBoxSelection(EMPTY_BOX_SELECTION);
      editor.chain().focus(undefined, { scrollIntoView: false }).run();
    }
  };

  createEffect(() => {
    const editor = props.editor;
    const container = props.scrollableContainerRef();

    if (!editor || !container) return;

    let frame: number | null = null;

    const shade = createBlockSelectionShade(container, "block-selection-shade");

    const update = () => {
      frame = null;
      const { doc, selection } = editor.state;

      if (!isBlockSelection(selection)) {
        shade.hide();
        return;
      }

      const selectedBlocks: HTMLElement[] = [];

      forEachSelectedBlock(
        doc,
        selection.from,
        selection.to,
        (_node, pos) => {
          const dom = editor.view.nodeDOM(pos);

          if (dom instanceof HTMLElement) selectedBlocks.push(dom);
        },
        { includeCoveredFragments: !isFragmentChildBlockSelection(selection) }
      );

      if (!selectedBlocks.length) {
        shade.hide();
        return;
      }

      shade.show(editor, selectedBlocks);
    };
    const scheduleUpdate = () => {
      if (frame !== null) return;

      frame = requestAnimationFrame(update);
    };
    const refreshShade = () => {
      invalidateBlockControlLayout(editor);
      shade.refresh();
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(refreshShade);

    observer?.observe(editor.view.dom);
    observer?.observe(container);
    window.addEventListener("resize", refreshShade);
    editor.on("transaction", scheduleUpdate);
    scheduleUpdate();

    onCleanup(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      shade.remove();
      observer?.disconnect();
      window.removeEventListener("resize", refreshShade);
      editor.off("transaction", scheduleUpdate);
    });
  });

  createEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("pointerleave", onPointerEnd);
    window.addEventListener("contextmenu", onPointerEnd);

    onCleanup(() => {
      setPointerDown(false);
      autoScroll.stop();
      document.documentElement.classList.remove("select-none", "cursor-crosshair");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("pointerleave", onPointerEnd);
      window.removeEventListener("contextmenu", onPointerEnd);
    });
  });

  return (
    <div
      class="contents"
      data-marquee-selecting={boxSelection().active ? "" : undefined}
      onPointerDown={onPointerDown}
    >
      {props.children}
      <Show when={boxSelection().active && props.scrollableContainerRef()}>
        <Portal mount={props.scrollableContainerRef()!}>
          <div
            class="absolute bg-gradient-to-tr opacity-10 rounded-lg z-10"
            style={{
              top: `${Math.min(boxSelection().y, boxSelection().currentY)}px`,
              left: `${Math.min(boxSelection().x, boxSelection().currentX)}px`,
              width: `${boxSelection().width}px`,
              height: `${boxSelection().height}px`
            }}
          />
        </Portal>
      </Show>
    </div>
  );
};

export { BlockSelection, createBlockSelectionShade };
