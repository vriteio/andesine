import { useTree } from "#web/components/tree";
import { useTreeKeyboard, isTreeMenuElement } from "#web/components/tree/use-tree-keyboard";
import { useWorkspace } from "#web/context/workspace";
import { useExplorerActions } from "./use-explorer-actions";
import { usePublishing } from "#web/context/publishing";
import { getPublishingEntryOverlayID } from "#web/lib/data";

interface ExplorerKeyboardInput {
  active(): boolean;
  getSelectionGroup(id: string): string;
  scrollItemIntoView(id: string): void;
}

const useExplorerKeyboard = (input: ExplorerKeyboardInput) => {
  const [{ isExpanded }, tree] = useTree();
  const { content } = useWorkspace();
  const publishing = usePublishing();
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
    const collectionOverlay = publishing.getCollectionOverlay(id);
    const pendingCollectionOverlay = publishing.getPendingCollectionOverlay(id);
    if (direction === "right") {
      if (!collection && !collectionOverlay && !pendingCollectionOverlay) return false;
      if (!isExpanded(id)) {
        tree.setExactSelection([]);
        tree.toggleExpanded(id);
        return true;
      }

      const level = content.tree.getLevel({ parentID: id });
      const childCollection =
        level.collections()[0]?.id ??
        publishing.getCollectionOverlaysInParent(id)[0]?.collectionID ??
        publishing.getPendingCollectionOverlaysInParent(id)[0]?.collectionID;
      const childEntry =
        level.entries()[0]?.id ??
        publishing.getEntryOverlaysInCollection(id).map(getPublishingEntryOverlayID)[0] ??
        publishing.getPendingEntryOverlaysInCollection(id)[0]?.entryID;
      const child = childCollection ?? childEntry;

      if (child) focusSingleItem(child, true);
      return true;
    }
    if ((collection || collectionOverlay || pendingCollectionOverlay) && isExpanded(id)) {
      tree.setExactSelection([]);
      tree.toggleExpanded(id);
      return true;
    }

    const entryOverlay = publishing.getEntryOverlay(id);
    const pendingEntryOverlay = publishing.getPendingEntryOverlay(id);
    const overlayCollectionID =
      entryOverlay?.snapshotCollectionID &&
      publishing.getCollectionOverlay(entryOverlay.snapshotCollectionID)
        ? entryOverlay.snapshotCollectionID
        : (entryOverlay?.collectionID ?? pendingEntryOverlay?.collectionID);
    const parent =
      collection?.ancestors.at(-1) ??
      collectionOverlay?.parentID ??
      pendingCollectionOverlay?.parentID ??
      content.entries.get({ entryID: id })?.collectionID ??
      overlayCollectionID;

    if (parent) focusSingleItem(parent, true);
    return Boolean(parent);
  };
  const keyboard = useTreeKeyboard({
    ...input,
    ...actions,
    navigateHierarchy,
    getLabel: (id) =>
      content.collections.get({ collectionID: id })?.name ??
      publishing.getCollectionOverlay(id)?.name ??
      publishing.getPendingCollectionOverlay(id)?.name ??
      content.entries.get({ entryID: id })?.name ??
      publishing.getEntryOverlay(id)?.name ??
      publishing.getPendingEntryOverlay(id)?.name ??
      ""
  });

  return keyboard;
};

export { isTreeMenuElement as isExplorerMenuElement, useExplorerKeyboard };
