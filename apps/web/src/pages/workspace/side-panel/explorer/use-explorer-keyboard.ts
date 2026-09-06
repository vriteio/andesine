import { useTree } from "#web/components/tree";
import { useTreeKeyboard, isTreeMenuElement } from "#web/components/tree/use-tree-keyboard";
import { useWorkspace } from "#web/context/workspace";
import { useExplorerActions } from "./use-explorer-actions";

interface ExplorerKeyboardInput {
  active(): boolean;
  scrollItemIntoView(id: string): void;
}

const useExplorerKeyboard = (input: ExplorerKeyboardInput) => {
  const [{ isExpanded }, tree] = useTree();
  const { content } = useWorkspace();
  const actions = useExplorerActions();
  const focusSingleItem = (id: string, scroll = false) => {
    tree.setExactSelection([]);
    keyboard.resetRange();
    tree.setFocusedItem(id, "keyboard");
    if (scroll) queueMicrotask(() => input.scrollItemIntoView(id));
  };
  const navigateHierarchy = (direction: "left" | "right") => {
    const id = actions.getFocusedVisibleID();
    if (!id) return false;

    const collection = content.collections.get({ collectionID: id });
    if (direction === "right") {
      if (!collection) return false;
      if (!isExpanded(id)) {
        tree.setExactSelection([]);
        tree.toggleExpanded(id);
        return true;
      }

      const level = content.tree.getLevel({ parentID: id });
      const child = level.collections()[0]?.id ?? level.entries()[0]?.id;
      if (child) focusSingleItem(child, true);
      return true;
    }
    if (collection && isExpanded(id)) {
      tree.setExactSelection([]);
      tree.toggleExpanded(id);
      return true;
    }

    const parent =
      collection?.ancestors.at(-1) ?? content.entries.get({ entryID: id })?.collectionID;
    if (parent) focusSingleItem(parent, true);
    return Boolean(parent);
  };
  const keyboard = useTreeKeyboard({
    ...input,
    ...actions,
    navigateHierarchy,
    getLabel: (id) =>
      content.collections.get({ collectionID: id })?.name ??
      content.entries.get({ entryID: id })?.name ??
      ""
  });

  return keyboard;
};

export { isTreeMenuElement as isExplorerMenuElement, useExplorerKeyboard };
