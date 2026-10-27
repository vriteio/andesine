import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import type { ElementPlace } from "../../../client-types";
import { isBlockSelection } from "#editor/extensions/block-selection";
import { dragHandleTargetPluginKey } from "#editor/ui/drag-handle/drag-handle-target-plugin";
import { dropTargetPluginKey } from "#editor/extensions/drop-target";

/** What an element's place depends on outside its own node; unchanged, the place stays. */
interface PlaceBase {
  pos: number;
  node: ProseMirrorNode;
  index: number;
  parentID: string | null;
  /** The selection touches the element, so its or its children's selection state can change. */
  nearSelection: boolean;
}

const EMPTY_PLACE: ElementPlace = {
  key: null,
  index: 0,
  parentID: null,
  children: [],
  blockSelected: false,
  inBlockSelection: false,
  dropTarget: false,
  dragged: false
};

/** The element's index among the same-name elements before it in its parent. */
const getSiblingIndex = ($pos: ResolvedPos, node: ProseMirrorNode | null): number => {
  let index = 0;

  for (let child = 0; child < $pos.index(); child += 1) {
    const sibling = $pos.parent.child(child);

    if (sibling.type.name === "element" && sibling.attrs.name === node?.attrs.name) index += 1;
  }

  return index;
};
/** The ID of the nearest element around the position. */
const getParentID = ($pos: ResolvedPos): string | null => {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "element") return $pos.node(depth).attrs.id;
  }

  return null;
};
const getPlaceBase = (editor: Editor, pos: number | undefined): PlaceBase | null => {
  if (typeof pos !== "number") return null;

  try {
    const { doc, selection } = editor.state;
    const $pos = doc.resolve(pos);
    const node = doc.nodeAt(pos);

    if (!node) return null;

    return {
      pos,
      node,
      index: getSiblingIndex($pos, node),
      parentID: getParentID($pos),
      nearSelection: selection.from <= pos + node.nodeSize && selection.to >= pos
    };
  } catch {
    return null;
  }
};
/** Where the element is: its index among same-name siblings, its parent, and its children. */
const getElementPlace = (editor: Editor, pos: number | undefined): ElementPlace => {
  const place: ElementPlace = { ...EMPTY_PLACE, children: [] };

  if (typeof pos !== "number") return place;

  try {
    const { doc, selection } = editor.state;
    const handleTarget = dragHandleTargetPluginKey.getState(editor.state);
    const drag = dropTargetPluginKey.getState(editor.state);
    const isDragged = (from: number, size: number) => {
      return Boolean(drag?.dragged && drag.dragged.from <= from && from + size <= drag.dragged.to);
    };
    const $pos = doc.resolve(pos);
    const node = doc.nodeAt(pos);

    place.key = node?.attrs.id ?? null;
    place.blockSelected =
      isBlockSelection(selection) &&
      selection.ranges.some(({ $from, $to }) => {
        return $from.pos === pos && $to.pos === pos + (node?.nodeSize ?? 0);
      });
    place.inBlockSelection =
      isBlockSelection(selection) &&
      selection.from <= pos &&
      selection.to >= pos + (node?.nodeSize ?? 0);
    place.dropTarget = drag?.target === pos;
    place.dragged = isDragged(pos, node?.nodeSize ?? 0);

    place.index = getSiblingIndex($pos, node);
    place.parentID = getParentID($pos);

    node?.forEach((child, offset) => {
      const from = pos + 1 + offset;
      const isElement = child.type.name === "element";
      const isSelected = selection.from < from + child.nodeSize && selection.to > from;
      // Only a block selection of the child itself, not of the element around it.
      const isBlockSelected =
        isBlockSelection(selection) &&
        selection.ranges.some(({ $from, $to }) => {
          return $from.pos === from && $to.pos === from + child.nodeSize;
        });

      place.children.push({
        key: child.attrs.id,
        type: child.type.name,
        ...(isElement && { element: child.attrs.name, props: child.attrs.props }),
        ...(child.attrs.language && { language: child.attrs.language }),
        ...(child.attrs.title && { title: child.attrs.title }),
        hasSelection: isSelected && !isBlockSelection(selection),
        blockSelected: isBlockSelected,
        handleTarget: handleTarget === from,
        dropTarget: drag?.target === from,
        dragged: isDragged(from, child.nodeSize)
      });
    });
  } catch {
    /* The node can be outside the current document while it is replaced. */
  }

  return place;
};

export { EMPTY_PLACE, getElementPlace, getPlaceBase };
export type { PlaceBase };
