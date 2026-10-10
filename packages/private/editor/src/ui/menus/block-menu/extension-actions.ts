import type { MenuItem } from "@andesine/components";
import type { Editor } from "@tiptap/core";
import type { BlockActionOrigin, BlockActions, BlockMenuPlacement } from "#editor/client-types";
import { EDITOR_MENU_Z_INDEX } from "#editor/ui/constants";
import { createBlockActionTarget, getSelectedBlocks } from "#editor/lib/block-action-target";
import { isPositionInInheritedField } from "#editor/ui/block-utils";

/** The block menu's state that block actions open their menus against. */
interface BlockMenuControls {
  /** What the block menu is anchored to; null when the dropdown keeps it internally. */
  getMenuAnchor(): DOMRect | null;
  holdTrigger(): () => void;
}

// The dropdown's default distance from its anchor.
const MENU_OFFSET = 4;

/** The anchor point that puts a card at `rect` with `placement`, as the dropdown places it. */
const getAnchorPoint = (rect: DOMRect, placement: BlockMenuPlacement): DOMRect => {
  const [side, align] = placement.split("-");
  const alignX = align === "end" ? rect.right : align ? rect.left : (rect.left + rect.right) / 2;
  const alignY = align === "end" ? rect.bottom : align ? rect.top : (rect.top + rect.bottom) / 2;
  const sideX = { left: rect.right + MENU_OFFSET, right: rect.left - MENU_OFFSET };
  const sideY = { top: rect.bottom + MENU_OFFSET, bottom: rect.top - MENU_OFFSET };

  return new DOMRect(
    sideX[side as keyof typeof sideX] ?? alignX,
    sideY[side as keyof typeof sideY] ?? alignY,
    0,
    0
  );
};
// Narrow screens show the block menu as a bottom sheet, which has no place next to the blocks.
const getOrigin = (menuID: string, menu: BlockMenuControls): BlockActionOrigin | null => {
  const card = window.matchMedia("(min-width: 768px)").matches
    ? document.querySelector(`[data-block-action-menu="${menuID}"]`)
    : null;
  const container = card?.closest<HTMLElement>("[data-editor-menu-container]");

  if (!card || !container) return null;

  // The final placement, e.g. flipped to the top when there was no room below.
  const placement = (card.getAttribute("data-placement") ?? "bottom-end") as BlockMenuPlacement;
  const rect = card.getBoundingClientRect();
  // A context menu's anchor point stays inside the dropdown, so it is derived from the card.
  const { x, y, width, height } = menu.getMenuAnchor() ?? getAnchorPoint(rect, placement);

  return {
    container,
    anchor: { x, y, width, height },
    placement,
    width: rect.width,
    zIndex: EDITOR_MENU_Z_INDEX.blockMenu,
    holdTrigger: menu.holdTrigger
  };
};
const createExtensionActionMenuItems = (
  editor: Editor,
  blockActions: BlockActions,
  menuID: string,
  menu: BlockMenuControls
): MenuItem[] => {
  const blocks = getSelectedBlocks(editor);
  const isAvailable =
    blocks && editor.isEditable && !isPositionInInheritedField(editor.state.doc, blocks[0].pos);

  if (!isAvailable) return [];

  const types = [...new Set(blocks.map(({ node }) => node.type.name))];

  return blockActions.get(types).map((action) => ({
    label: action.label,
    icon: action.icon ?? "i-lucide:puzzle",
    // A pending run keeps the menu open with a spinner, then closes it.
    onClick: () => {
      return action.run(
        createBlockActionTarget(editor, getSelectedBlocks(editor) ?? blocks),
        getOrigin(menuID, menu)
      );
    }
  }));
};

export { createExtensionActionMenuItems };
