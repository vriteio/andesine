import { IconButton, Tooltip } from "@andesine/components";
import { debounce } from "@solid-primitives/scheduled";
import { type Editor } from "@tiptap/core";
import { type Accessor, type Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  getBlockControlAnchorRect,
  getBlockControlTargetAtY,
  getBlockSelectionTopTarget,
  getCachedElementRect,
  getEditorScrollContainer,
  isPointInBlockSelectionControlArea,
  isPointInBlockControlArea,
  isTargetInBlockSelection,
  keepsViewChildTarget,
  registerSelectionControlHiding
} from "#editor/ui/block-control-targeting";
import type { BlockControlTarget } from "#editor/ui/block-control-targeting";
import { createVerticalAutoScroll } from "#editor/ui/auto-scroll";
import { BLOCK_CONTROL_HIDE_DELAY, BLOCK_CONTROL_MOVE_DELAY } from "#editor/ui/constants";
import { createDragHandlePlugin, dragHandlePluginKey } from "./drag-handle-plugin";
import { createListItemTargetResolver } from "./list-item-target";
import { DragHandleTargetPlugin, dragHandleTargetPluginKey } from "./drag-handle-target-plugin";
import { isPositionInInheritedField } from "#editor/ui/block-utils";
import { isTableAtScrollStart } from "#editor/ui/views/table-view/scroll";
import { getElementIssue, getElementViews } from "#editor/lib/element-content";
import { useBlockMenuContext } from "#editor/ui/menus/block-menu/context";

interface DragHandleMenuProps {
  editor: Editor;
  menuContainerRef: Accessor<HTMLElement | null>;
}

// Active drags stay visible; otherwise the pointer must resolve to a non-title block.
const shouldShowDragHandle = (
  available: boolean,
  dragging: boolean,
  target: BlockControlTarget | null
): boolean =>
  dragging ||
  Boolean(
    available &&
    target &&
    target.node.type.name !== "title" &&
    (target.node.type.name !== "table" || isTableAtScrollStart(target.dom))
  );

const DragHandleMenu: Component<DragHandleMenuProps> = (props) => {
  const { openMenu, menuOpened } = useBlockMenuContext();

  let wrapperRef: HTMLDivElement | undefined;
  let hoverAreaRef: HTMLDivElement | undefined;
  let pointer = { x: 0, y: 0 };
  let dragStarting = false;
  let dragHandleAvailable = false;
  let currentControlTarget: BlockControlTarget | null = null;
  let decoratedHeadingTargetPos: number | null = null;
  const [isEmptyParagraph, setIsEmptyParagraph] = createSignal(false);
  /** Why the target element's content doesn't fit its rules, e.g. a paragraph in a code group. */
  const [warning, setWarning] = createSignal<string | null>(null);
  // A click, not a drag, opens the block's menu at the handle; a block selection keeps its blocks.
  const openBlockMenu = (event: MouseEvent & { currentTarget: HTMLElement }) => {
    const target = currentControlTarget;

    if (!target) return;

    const isSelected = isTargetInBlockSelection(props.editor, target);
    const chain = props.editor.chain();

    event.preventDefault();
    event.stopPropagation();

    if (!isSelected) {
      chain.setBlockSelection({
        from: target.pos,
        to: target.pos + target.node.nodeSize,
        depth: props.editor.state.doc.resolve(target.pos).depth
      });
    }

    chain.focus().run();
    openMenu(event.currentTarget);
  };

  onMount(() => {
    const menuContainer = props.menuContainerRef();

    if (!wrapperRef || !menuContainer) return;

    wrapperRef.style.visibility = "hidden";
    wrapperRef.style.opacity = "0";
    wrapperRef.style.position = "absolute";
    wrapperRef.remove();
    const scrollContainer = getEditorScrollContainer(props.editor);
    const autoScroll = createVerticalAutoScroll(() => scrollContainer);
    const isDragging = () => dragStarting || wrapperRef.dataset.dragging === "true";
    const handleDragOver = (event: DragEvent) => {
      if (isDragging()) autoScroll.update(event);
    };
    const stopAutoScroll = () => autoScroll.stop();
    // The handle's target: headings and elements hide their gutter markers, e.g. `H2` or a warning,
    // which the handle covers, and element views see it in `children`, e.g. to mark a card.
    const updateHeadingIndicator = (visible: boolean) => {
      const target = currentControlTarget;
      const nextTargetPos = visible && target ? target.pos : null;

      if (nextTargetPos === decoratedHeadingTargetPos) return;

      decoratedHeadingTargetPos = nextTargetPos;
      props.editor.view.dispatch(
        props.editor.state.tr.setMeta(dragHandleTargetPluginKey, { pos: nextTargetPos })
      );
    };
    const updateWarning = () => {
      const target = currentControlTarget;
      const elementViews = getElementViews(props.editor);
      const issue =
        target?.node.type.name === "element" && elementViews
          ? getElementIssue(props.editor.state.doc, target.pos, elementViews)
          : null;
      const hint = issue?.cleanable ? " Open this menu to clean up." : "";

      setWarning(issue ? `${issue.message}${hint}` : null);
    };
    const updateDragHandleVisibility = () => {
      const visible = shouldShowDragHandle(dragHandleAvailable, isDragging(), currentControlTarget);
      const tableTarget = currentControlTarget?.node.type.name === "table";

      wrapperRef.style.visibility = visible ? "visible" : "hidden";
      wrapperRef.style.opacity = visible ? "1" : "0";
      wrapperRef.style.pointerEvents = visible && !tableTarget ? "auto" : "none";
      updateHeadingIndicator(visible);
      updateWarning();
    };
    const setDragHandleAvailable = (available: boolean) => {
      dragHandleAvailable = available;
      updateDragHandleVisibility();
    };
    const hideDragHandle = debounce(() => setDragHandleAvailable(false), BLOCK_CONTROL_HIDE_DELAY);

    const listItemTargetResolver = createListItemTargetResolver(props.editor, () => pointer.y);
    const setCurrentTarget = (
      source: BlockControlTarget | null,
      selection = getBlockSelectionTopTarget(props.editor)
    ) => {
      const usesSelection = Boolean(
        selection && source && isTargetInBlockSelection(props.editor, source)
      );
      const target = usesSelection ? selection : source;

      currentControlTarget = target;
      setIsEmptyParagraph(
        Boolean(
          !usesSelection && source?.node.type.name === "paragraph" && source.node.content.size === 0
        )
      );

      return target;
    };
    const isPointerTargetAvailable = (
      target: BlockControlTarget | null
    ): target is BlockControlTarget =>
      Boolean(
        target &&
        isPointInBlockControlArea(props.editor, target, {
          x: pointer.x,
          y: pointer.y,
          side: "left"
        })
      );
    const isPointerInBlockSelectionArea = () => {
      return isPointInBlockSelectionControlArea(props.editor, {
        ...pointer,
        side: "left"
      });
    };
    const positionDragHandle = (target: BlockControlTarget) => {
      const menuContainer = props.menuContainerRef();

      if (!menuContainer) return;

      const referenceRect = getBlockControlAnchorRect(props.editor, target);
      const menuContainerRect = getCachedElementRect(props.editor, menuContainer);

      wrapperRef.style.left = `${referenceRect.left - menuContainerRect.left - wrapperRef.offsetWidth}px`;
      wrapperRef.style.top = `${
        referenceRect.top -
        menuContainerRect.top +
        (referenceRect.height - wrapperRef.offsetHeight) / 2
      }px`;
    };
    const showDragHandle = (
      target: BlockControlTarget,
      source: BlockControlTarget | null,
      selection: BlockControlTarget | null
    ) => {
      const nodeRect =
        target.node.type.name === "fragment"
          ? getBlockControlAnchorRect(props.editor, target)
          : getCachedElementRect(props.editor, target.dom);

      setCurrentTarget(source, selection);
      positionDragHandle(target);

      if (hoverAreaRef) {
        hoverAreaRef.style.top = `${wrapperRef.offsetHeight}px`;
        hoverAreaRef.style.height = `${Math.max(0, nodeRect.height - wrapperRef.offsetHeight)}px`;
        hoverAreaRef.style.pointerEvents = target.node.type.name === "table" ? "none" : "auto";
      }

      hideDragHandle.clear();
      setDragHandleAvailable(true);
    };
    const moveDragHandle = debounce(showDragHandle, BLOCK_CONTROL_MOVE_DELAY);

    let pointerFrame: number | null = null;
    let pendingPointer: { x: number; y: number } | null = null;
    const handlePointerMove = (event: PointerEvent) => {
      pendingPointer = { x: event.clientX, y: event.clientY };

      if (pointerFrame !== null) return;

      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = null;
        const nextPointer = pendingPointer;

        pendingPointer = null;
        if (!nextPointer) return;

        const previousX = pointer.x;

        pointer = nextPointer;

        if (!props.editor.isEditable) {
          hideDragHandle.clear();
          moveDragHandle.clear();
          setDragHandleAvailable(false);
          return;
        }

        // The current view child keeps the handle while the pointer goes out to it.
        if (
          dragHandleAvailable &&
          keepsViewChildTarget(
            props.editor,
            currentControlTarget,
            { ...pointer, previousX },
            "left"
          )
        ) {
          hideDragHandle.clear();
          moveDragHandle.clear();
          return;
        }

        const pointerTarget = listItemTargetResolver.resolve(
          getBlockControlTargetAtY(props.editor, pointer.y, { x: pointer.x })
        );
        const selectionTarget = getBlockSelectionTopTarget(props.editor);
        const pointerInSelectionArea = Boolean(selectionTarget && isPointerInBlockSelectionArea());
        const effectivePointerTarget = pointerInSelectionArea ? selectionTarget : pointerTarget;
        const usesSelection = Boolean(
          selectionTarget &&
          effectivePointerTarget &&
          isTargetInBlockSelection(props.editor, effectivePointerTarget)
        );
        const target = usesSelection ? selectionTarget : effectivePointerTarget;

        // A block selection forms one continuous hover area, including gaps between blocks.
        if (
          !target ||
          isPositionInInheritedField(props.editor.state.doc, target.pos) ||
          (!pointerInSelectionArea && !isPointerTargetAvailable(effectivePointerTarget))
        ) {
          moveDragHandle.clear();
          hideDragHandle();
          return;
        }

        const isMove = dragHandleAvailable && currentControlTarget?.pos !== target.pos;

        hideDragHandle.clear();

        if (isMove) {
          moveDragHandle(target, effectivePointerTarget, selectionTarget);
          return;
        }

        moveDragHandle.clear();
        showDragHandle(target, effectivePointerTarget, selectionTarget);
      });
    };
    const handlePointerLeave = () => {
      // Active drags retain the handle after the pointer leaves the editor.
      if (isDragging()) return;

      moveDragHandle.clear();
      hideDragHandle();
    };

    scrollContainer?.addEventListener("pointermove", handlePointerMove);
    scrollContainer?.addEventListener("pointerleave", handlePointerLeave);
    props.editor.view.dom.addEventListener("scroll", updateDragHandleVisibility, true);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragend", stopAutoScroll);
    window.addEventListener("drop", stopAutoScroll);

    const { plugin, unbind } = createDragHandlePlugin({
      container: menuContainer,
      element: wrapperRef,
      editor: props.editor,
      getDragTarget: () => currentControlTarget,
      onDragStart: () => {
        hideDragHandle.clear();
        moveDragHandle.clear();
        dragStarting = true;
        updateDragHandleVisibility();
      },
      onDragEnd: () => {
        hideDragHandle.clear();
        moveDragHandle.clear();
        dragStarting = false;
        autoScroll.stop();
        setDragHandleAvailable(false);
      }
    });

    props.editor.registerPlugin(DragHandleTargetPlugin());
    props.editor.registerPlugin(plugin);
    const unregisterSelectionHandler = registerSelectionControlHiding(props.editor, () => {
      if (isDragging()) return;

      hideDragHandle.clear();
      moveDragHandle.clear();
      setCurrentTarget(null, null);
      setDragHandleAvailable(false);
      listItemTargetResolver.reset();
      props.editor.commands.setMeta("hideDragHandle", true);
    });

    onCleanup(() => {
      if (pointerFrame !== null) cancelAnimationFrame(pointerFrame);
      hideDragHandle.clear();
      moveDragHandle.clear();
      scrollContainer?.removeEventListener("pointermove", handlePointerMove);
      scrollContainer?.removeEventListener("pointerleave", handlePointerLeave);
      props.editor.view.dom.removeEventListener("scroll", updateDragHandleVisibility, true);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragend", stopAutoScroll);
      window.removeEventListener("drop", stopAutoScroll);
      autoScroll.stop();
      unbind();
      unregisterSelectionHandler();
      props.editor.unregisterPlugin(dragHandlePluginKey);
      props.editor.unregisterPlugin(dragHandleTargetPluginKey);
    });
  });

  return (
    <div
      class="flex items-center pr-2"
      ref={wrapperRef}
      data-drag-handle
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        class="absolute inset-x-0 pointer-events-auto"
        ref={hoverAreaRef}
        data-drag-handle-hover-area
      />
      <Show when={isEmptyParagraph()}>
        <IconButton
          icon="i-lucide:plus"
          variant="ghost"
          class="pointer-events-auto"
          badge
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            const pos = currentControlTarget?.pos;

            if (pos === undefined) return;

            props.editor
              .chain()
              .setTextSelection(pos + 1)
              .insertContent("/")
              .focus()
              .run();
          }}
        />
      </Show>
      <Tooltip
        content={
          <div class="flex flex-col items-start gap-px whitespace-normal max-w-52">
            <span class="font-mono text-[80%] opacity-50 mb-0.5">Warning</span>
            <span class="text-xs">{warning()}</span>
          </div>
        }
        enabled={Boolean(warning()) && !menuOpened()}
        placement="right"
        fixed
      >
        <IconButton
          icon="i-lucide:grip-vertical"
          class="pointer-events-auto cursor-grab active:cursor-grabbing"
          variant="ghost"
          badge
          onClick={openBlockMenu}
        />
        {/* The element's gutter warning, which the handle covers, smaller in its corner. */}
        <Show when={warning()}>
          <div class="pointer-events-none absolute -bottom-1 -right-1 flex rounded bg-white">
            <div class="flex rounded bg-amber-500/10 p-0.5 text-amber-500">
              <div class="i-lucide:triangle-alert h-3 w-3" />
            </div>
          </div>
        </Show>
      </Tooltip>
    </div>
  );
};

export { DragHandleMenu };
