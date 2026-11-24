import { createCodeBlockMenuItems } from "./code-block";
import { createElementMenuItems } from "./element";
import { createExtensionActionMenuItems } from "./extension-actions";
import type {
  BlockActions,
  EditorComments,
  EditorIcons,
  EditorLinks,
  ElementViews
} from "#editor/client-types";
import { createImageMenuItems } from "./image";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { getBlockCommentTarget, updateComments } from "#editor/extensions/comments";
import { isSharedBlock } from "#editor/extensions/suggesting";
import { DropdownMenu, IconButton, type MenuItem } from "@andesine/components";
import { debounce } from "@solid-primitives/scheduled";
import { type Editor, type EditorEvents } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  untrack,
  type JSX,
  type ParentComponent,
  Show
} from "solid-js";
import { useBlockMenuContext } from "./context";
import { sourceElements } from "#editor/ui/views/element-view/source-mode";
import {
  getBlockControlAnchorRect,
  getBlockControlTargetAtY,
  getBlockSelectionTopTarget,
  getCachedElementRect,
  getEditorScrollContainer,
  isPointInBlockControlArea,
  keepsViewChildTarget,
  isTargetInBlockSelection,
  registerSelectionControlHiding
} from "#editor/ui/block-control-targeting";
import type { BlockControlTarget, BlockControlRange } from "#editor/ui/block-control-targeting";
import {
  BLOCK_CONTROL_HIDE_DELAY,
  BLOCK_CONTROL_SIZE,
  EDITOR_MENU_Z_INDEX
} from "#editor/ui/constants";
import { isPositionInInheritedField } from "#editor/ui/block-utils";
import { createBlockControlMove } from "#editor/ui/block-control-move";
import { getSelectedRequiredFields } from "#editor/lib/optional-fields";
import { createTableMenuItems } from "./table";
import { createTurnIntoMenuItem } from "./turn-into";
import { isBlockAtScrollEnd } from "#editor/ui/block-scroll";

interface BlockMenuProps {
  menuID: string;
  notify(type: "success" | "error", text: string): void;
  editor: Editor | null;
  /** Only copying and commenting. */
  readOnly?: boolean;
  blockActions?: BlockActions;
  comments?: EditorComments;
  elementViews?: ElementViews;
  links?: EditorLinks;
  icons?: EditorIcons;
  textMenuSelectionRange: BlockControlRange | null;
  anchorPoint: { x: number; y: number } | null;
  /** The last context menu's point, which the dropdown keeps internally. */
  contextMenuPoint: { x: number; y: number } | null;
  menuOpened: boolean;
  setMenuOpened(opened: boolean): void;
}

type BlockMenuItem = MenuItem | (() => JSX.Element);
type BlockMenuItems = NonNullable<MenuItem["items"]>;

const getMenuGroups = (items: BlockMenuItems): BlockMenuItem[][] => {
  if (items.every((item): item is BlockMenuItem[] => Array.isArray(item)))
    return items.filter((group) => group.length > 0);

  return items.length ? [items.flat()] : [];
};

const BlockMenu: ParentComponent<BlockMenuProps> = (props) => {
  const { handleCopy, handleDelete, hasMenuItems } = useBlockMenuContext();
  const [currentNodePos, setCurrentNodePos] = createSignal(-1);
  const [coords, setCoords] = createSignal({ top: -10000, left: -10000 });
  const [hoverAreaHeight, setHoverAreaHeight] = createSignal(0);
  // Moves the trigger below a comment button on its line.
  const [commentOffset, setCommentOffset] = createSignal(0);
  const [triggerAvailable, setTriggerAvailable] = createSignal(false);
  const [contextMenuMode, setContextMenuMode] = createSignal(false);
  // Menus of block actions, which open in the menu's place, keep the trigger like the open menu.
  const [triggerHolds, setTriggerHolds] = createSignal(0);
  const [blockLayoutVersion, setBlockLayoutVersion] = createSignal(0);
  const [hoverAreaInert, setHoverAreaInert] = createSignal(false);
  const [imageItems, setImageItems] = createSignal<BlockMenuItems>([]);
  const [codeItems, setCodeItems] = createSignal<BlockMenuItems>([]);
  const [elementItems, setElementItems] = createSignal<BlockMenuItems>([]);
  const [tableItems, setTableItems] = createSignal<BlockMenuItems>([]);
  const [turnIntoItems, setTurnIntoItems] = createSignal<BlockMenuItems>([]);
  const [extensionItems, setExtensionItems] = createSignal<BlockMenuItems>([]);
  const [requiredFields, setRequiredFields] = createSignal<ProseMirrorNode[]>([]);

  let trigger: HTMLDivElement | undefined;

  const menuItems = (): BlockMenuItem[][] => {
    const tableActions = tableItems();
    // Required entry fields can't be removed, and a property's copy is of no use.
    const copyable = !requiredFields().some(({ type }) => type.name === "property");
    const deletable = !requiredFields().length;
    const copyItems: MenuItem[] = copyable
      ? [{ label: "Copy", icon: "i-lucide:copy", onClick: handleCopy, shortcut: "$mod+c" }]
      : [];
    const commentItems = createCommentItems();
    const items: MenuItem[] = [
      ...copyItems,
      ...(deletable
        ? [
            {
              label: "Delete",
              icon: "i-lucide:trash",
              onClick: handleDelete,
              color: "danger" as const,
              shortcut: "$mod+backspace"
            }
          ]
        : [])
    ];

    if (props.readOnly) return [copyItems, commentItems].filter((group) => group.length);

    if (tableActions.length > 0) {
      return [
        ...getMenuGroups(tableActions),
        ...getMenuGroups(elementItems()),
        commentItems,
        items
      ].filter((group) => group.length);
    }

    if (imageItems().length) {
      return [
        ...getMenuGroups(imageItems()),
        ...getMenuGroups(elementItems()),
        commentItems,
        items
      ].filter((group) => group.length);
    }

    return [
      ...getMenuGroups(codeItems()),
      ...getMenuGroups(turnIntoItems()),
      ...getMenuGroups(elementItems()),
      ...getMenuGroups(extensionItems()),
      commentItems,
      ...getMenuGroups(items)
    ].filter((group) => group.length);
  };
  const createCommentItems = (): MenuItem[] => {
    const editor = props.editor;
    const draft = editor && props.comments?.canComment ? getBlockCommentTarget(editor) : null;

    if (!editor || !draft || !isSharedBlock(editor, draft.target.blockID!)) return [];

    return [
      {
        label: "Comment",
        icon: "i-tabler:message-plus",
        onClick: () => updateComments(editor, { draft })
      }
    ];
  };
  const hasElementForm = () => elementItems().some((item) => Array.isArray(item));
  const triggerPinned = () => props.menuOpened || triggerHolds() > 0;
  const handleOpenedChange = (opened: boolean) => {
    const isClosing = !opened && props.menuOpened;

    props.setMenuOpened(opened);

    if (!opened && !triggerHolds()) {
      setTriggerAvailable(false);
    }

    // The menu gives the focus back to its trigger, which a menu from the keyboard or a right
    // click doesn't show; the editor takes it, e.g. after Escape, to go on with the arrow keys.
    if (isClosing) requestAnimationFrame(refocusEditor);
  };
  const refocusEditor = () => {
    const editor = props.editor;
    const active = document.activeElement;
    const isLost =
      !active ||
      active === document.body ||
      Boolean(active.closest("[data-block-menu-trigger], [data-block-action-menu]"));

    if (editor && !editor.isDestroyed && isLost) editor.view.focus();
  };
  // Keeps the trigger shown and in place until the returned release is called.
  const holdTrigger = () => {
    let released = false;

    setTriggerHolds((holds) => holds + 1);

    return () => {
      if (released) return;

      released = true;
      setTriggerHolds((holds) => holds - 1);
      if (!triggerPinned()) setTriggerAvailable(false);
    };
  };
  // What the menu is anchored to: the context menu's point, another point, or the trigger.
  const getMenuAnchor = (): DOMRect | null => {
    const point = contextMenuMode() ? props.contextMenuPoint : props.anchorPoint;

    if (point) return new DOMRect(point.x, point.y, 0, 0);
    if (contextMenuMode()) return null;

    return trigger?.getBoundingClientRect() ?? null;
  };
  const getCurrentTarget = () => {
    const editor = props.editor;
    const pos = currentNodePos();

    if (!editor || pos < 0) return null;

    const node = editor.state.doc.nodeAt(pos);
    const dom = node ? editor.view.nodeDOM(pos) : null;

    return node && dom instanceof HTMLElement ? { dom, node, pos } : null;
  };
  const rangesOverlap = (target: BlockControlTarget, range: BlockControlRange): boolean => {
    return target.pos < range.to && target.pos + target.node.nodeSize > range.from;
  };
  const triggerVisible = () => {
    const target = getCurrentTarget();

    // The block's scroll position and width aren't reactive.
    blockLayoutVersion();

    // Hide the trigger when the menu was opened via 'right click' or when there's a text menu opened within the block area
    if (
      !triggerAvailable() ||
      !props.editor ||
      !target ||
      isPositionInInheritedField(props.editor.state.doc, target.pos) ||
      !hasMenuItems(target.node) ||
      !isBlockAtScrollEnd(target.dom)
    ) {
      return false;
    }
    if (contextMenuMode() && isTargetInBlockSelection(props.editor, target)) return false;
    if (props.textMenuSelectionRange && rangesOverlap(target, props.textMenuSelectionRange)) {
      return false;
    }

    return true;
  };

  createEffect(() => {
    const editor = props.editor;
    let codeMenuKey: string | undefined;
    let elementMenuID: string | undefined;

    const updateMenuItems = (event?: EditorEvents["transaction"]) => {
      if (event && !event.transaction.docChanged && !event.transaction.selectionSet) return;

      const selection = editor?.state.selection;
      const codeNode =
        selection?.$from.parent.type.name === "codeBlock"
          ? selection.$from.parent
          : selection && editor?.state.doc.nodeAt(selection.from);
      const nextCodeMenuKey =
        codeNode?.type.name === "codeBlock"
          ? `${codeNode.attrs.id}:${codeNode.attrs.language || ""}`
          : undefined;

      if (!untrack(() => props.menuOpened) || nextCodeMenuKey !== codeMenuKey) {
        setCodeItems(
          editor && !editor.isDestroyed ? createCodeBlockMenuItems(editor, props.notify) : []
        );
        codeMenuKey = nextCodeMenuKey;
      }
      const nextElementID = editor?.state.doc.nodeAt(editor.state.selection.from)?.attrs.id;

      // Preserve the props form's drafts while the menu is open on the same element.
      if (!untrack(() => props.menuOpened) || nextElementID !== elementMenuID) {
        setElementItems(
          editor && !editor.isDestroyed
            ? createElementMenuItems(editor, props.elementViews, props)
            : []
        );
        elementMenuID = nextElementID;
      }

      setTableItems(editor && !editor.isDestroyed ? createTableMenuItems(editor) : []);
      setTurnIntoItems(editor && !editor.isDestroyed ? createTurnIntoMenuItem(editor) : []);
      setRequiredFields(editor && !editor.isDestroyed ? getSelectedRequiredFields(editor) : []);
      setExtensionItems(
        editor && !editor.isDestroyed && props.blockActions
          ? createExtensionActionMenuItems(editor, props.blockActions, props.menuID, {
              getMenuAnchor,
              holdTrigger
            })
          : []
      );
    };

    updateMenuItems();
    editor?.on("transaction", updateMenuItems);
    onCleanup(() => editor?.off("transaction", updateMenuItems));
    // "Show tags" changes no transaction, but its label follows it.
    createEffect(
      on(
        sourceElements,
        () => {
          setElementItems(
            editor && !editor.isDestroyed
              ? createElementMenuItems(editor, props.elementViews, props)
              : []
          );
        },
        { defer: true }
      )
    );
  });

  createEffect(() => {
    const editor = props.editor;

    let imageMenuID: string | undefined;

    const updateMenuItems = (event?: EditorEvents["transaction"]) => {
      if (event && !event.transaction.docChanged && !event.transaction.selectionSet) return;

      const nextImageItems =
        editor && !editor.isDestroyed
          ? createImageMenuItems(editor, () => handleOpenedChange(false))
          : [];
      const nextImageID = editor?.state.doc.nodeAt(editor.state.selection.from)?.attrs.id;

      // Preserve input drafts while the menu is open on the same image.
      if (
        !untrack(() => props.menuOpened) ||
        nextImageID !== imageMenuID ||
        !nextImageItems.length
      ) {
        setImageItems(nextImageItems);
        imageMenuID = nextImageID;
      }
    };

    updateMenuItems();
    editor?.on("transaction", updateMenuItems);
    onCleanup(() => editor?.off("transaction", updateMenuItems));
  });

  createEffect(() => {
    const editor = props.editor;

    if (!editor) {
      setTriggerAvailable(false);
      return;
    }

    const hideTrigger = debounce(() => {
      if (!triggerPinned()) setTriggerAvailable(false);
    }, BLOCK_CONTROL_HIDE_DELAY);
    const showTrigger = (target: BlockControlTarget) => {
      const scrollContainer = getEditorScrollContainer(editor);

      if (!scrollContainer) {
        hideTrigger();
        return;
      }

      const blockRect = getCachedElementRect(editor, target.dom);
      const referenceRect = getBlockControlAnchorRect(editor, target);
      const scrollContainerRect = getCachedElementRect(editor, scrollContainer);
      const menuLeft = referenceRect.right + 8;
      const toY = (y: number) => y - scrollContainerRect.top + scrollContainer.scrollTop;
      const top = toY(referenceRect.top) + (referenceRect.height - BLOCK_CONTROL_SIZE) / 2;
      const commentButton = [...scrollContainer.querySelectorAll("[data-comment-button]")]
        .map((button) => button.getBoundingClientRect())
        .find((rect) => Math.abs(toY(rect.top) - top) < BLOCK_CONTROL_SIZE);

      const triggerTop = commentButton ? toY(commentButton.bottom) + 4 : top;

      currentTarget = target;
      setCurrentNodePos(target.pos);
      setCommentOffset(triggerTop - top);
      setCoords({
        top: triggerTop,
        left: menuLeft - scrollContainerRect.left + scrollContainer.scrollLeft
      });
      setHoverAreaHeight(blockRect.height);
      setHoverAreaInert(["codeBlock", "table"].includes(target.node.type.name));
      hideTrigger.clear();
      setTriggerAvailable(true);
    };
    const moveTrigger = createBlockControlMove(showTrigger);

    let currentTarget: BlockControlTarget | null = null;
    let previousX = 0;

    const updatePosition = (event: PointerEvent) => {
      const pointer = { x: event.clientX, y: event.clientY, previousX };

      previousX = event.clientX;

      if (triggerPinned() && !contextMenuMode()) return;

      // Also over the safe area from a comment button.
      const isOverTrigger =
        triggerAvailable() &&
        event.target instanceof Element &&
        event.target.closest("[data-block-menu-trigger]");

      if (isOverTrigger) {
        hideTrigger.clear();
        moveTrigger.clear();
        return;
      }

      // Threads beside a line take the trigger's place.
      const isOverComments =
        event.target instanceof Element &&
        event.target.closest("[data-comment-thread-card], [data-comment-popover]");

      if (isOverComments) {
        moveTrigger.clear();
        hideTrigger();
        return;
      }

      // The current view child keeps the trigger while the pointer goes out to it.
      if (triggerAvailable() && keepsViewChildTarget(editor, currentTarget, pointer, "right")) {
        hideTrigger.clear();
        moveTrigger.clear();
        return;
      }

      try {
        const pointerTarget = getBlockControlTargetAtY(editor, event.clientY, {
          listItemSpecific: false,
          x: event.clientX
        });
        const selectionTarget = getBlockSelectionTopTarget(editor);
        const target =
          pointerTarget && selectionTarget && isTargetInBlockSelection(editor, pointerTarget)
            ? selectionTarget
            : pointerTarget;
        // Only show the trigger when the pointer is over a block area
        if (
          !pointerTarget ||
          !target ||
          !isPointInBlockControlArea(editor, pointerTarget, {
            x: event.clientX,
            y: event.clientY,
            side: "right"
          })
        ) {
          moveTrigger.clear();
          hideTrigger();
          return;
        }

        const isMove = triggerAvailable() && currentTarget?.pos !== target.pos;

        hideTrigger.clear();

        if (isMove) {
          moveTrigger(target);
          return;
        }

        moveTrigger.clear();
        showTrigger(target);
      } catch {
        moveTrigger.clear();
        hideTrigger();
      }
    };
    const handlePointerLeave = () => {
      // Opened dropdown forces the trigger to remain visible
      if (!triggerPinned()) {
        moveTrigger.clear();
        hideTrigger();
      }
    };
    const updateBlockLayout = () => setBlockLayoutVersion((version) => version + 1);
    const updateDocLayout = ({ transaction }: EditorEvents["transaction"]) => {
      if (transaction.docChanged) requestAnimationFrame(updateBlockLayout);
    };
    const scrollContainer = getEditorScrollContainer(editor);
    const unregisterSelectionHandler = registerSelectionControlHiding(editor, () => {
      hideTrigger.clear();
      moveTrigger.clear();
      setTriggerAvailable(false);
    });

    // `editor.view` is gone once the editor is destroyed.
    const editorDOM = editor.view.dom;

    scrollContainer?.addEventListener("pointermove", updatePosition);
    scrollContainer?.addEventListener("pointerleave", handlePointerLeave);
    editorDOM.addEventListener("scroll", updateBlockLayout, true);
    editor.on("transaction", updateDocLayout);
    onCleanup(() => {
      hideTrigger.clear();
      moveTrigger.clear();
      scrollContainer?.removeEventListener("pointermove", updatePosition);
      scrollContainer?.removeEventListener("pointerleave", handlePointerLeave);
      editorDOM.removeEventListener("scroll", updateBlockLayout, true);
      editor.off("transaction", updateDocLayout);
      unregisterSelectionHandler();
    });
  });

  return (
    <DropdownMenu
      title="Block actions"
      anchorPoint={props.anchorPoint}
      portal={false}
      positioningStrategy="absolute"
      onContextMenuChange={setContextMenuMode}
      trigger={() => (
        <div
          ref={trigger}
          class="absolute pointer-events-auto"
          data-block-menu-trigger
          data-menu
          style={{
            left: `${coords().left}px`,
            top: `${coords().top}px`,
            visibility: triggerVisible() ? "visible" : "hidden"
          }}
        >
          {/* A safe area from the comment button above. */}
          <Show when={commentOffset() > 0}>
            <div
              class="absolute -inset-x-2 pointer-events-auto"
              style={{
                top: `${-commentOffset() - 8}px`,
                height: `${commentOffset() + BLOCK_CONTROL_SIZE + 16}px`
              }}
            />
          </Show>
          {/* Over these blocks, it would take the hover from their scrollbars and handles. */}
          <Show when={!hoverAreaInert()}>
            <div
              class="absolute -left-2 top-0 w-2 pointer-events-auto"
              style={{ height: `${hoverAreaHeight()}px` }}
            />
            <div
              class="absolute left-0 w-full pointer-events-auto"
              style={{
                height: `${Math.max(0, hoverAreaHeight() - BLOCK_CONTROL_SIZE)}px`,
                top: `${BLOCK_CONTROL_SIZE}px`
              }}
            />
          </Show>
          <IconButton
            icon="i-lucide:ellipsis"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();

              if (!props.editor) {
                return;
              }

              const { state } = props.editor;
              const node = state.doc.nodeAt(currentNodePos());
              const dom = node ? props.editor.view.nodeDOM(currentNodePos()) : null;
              const target =
                node && dom instanceof HTMLElement ? { dom, node, pos: currentNodePos() } : null;

              if (
                target &&
                currentNodePos() >= 0 &&
                (!isBlockSelection(props.editor.state.selection) ||
                  !isTargetInBlockSelection(props.editor, target))
              ) {
                props.editor
                  .chain()
                  .focus(undefined, { scrollIntoView: false })
                  .setBlockSelection({
                    from: currentNodePos(),
                    to: currentNodePos() + target.node.nodeSize,
                    depth: state.doc.resolve(currentNodePos()).depth
                  })
                  .run();
              }

              setTriggerAvailable(true);
              props.setMenuOpened(true);
            }}
          />
        </div>
      )}
      class="absolute inset-0 pointer-events-none"
      style={{
        // Over the comment buttons while open.
        "z-index": String(EDITOR_MENU_Z_INDEX.blockMenu + (props.menuOpened ? 2 : 0))
      }}
      opened={props.menuOpened}
      setOpened={handleOpenedChange}
      cardProps={{
        ...{ "data-block-action-menu": props.menuID },
        class: imageItems().length || codeItems().length || hasElementForm() ? "w-64" : "w-48"
      }}
      items={menuItems()}
    />
  );
};

export { BlockMenu };
