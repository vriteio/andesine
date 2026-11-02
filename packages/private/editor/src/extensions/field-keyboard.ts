import { Extension } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Selection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

interface AdjacentField {
  node: ProseMirrorNode;
  pos: number;
}

type ArrowDirection = "down" | "left" | "right" | "up";

const isField = (node: ProseMirrorNode): boolean => {
  return node.type.name === "fragment" || node.type.name === "property";
};
/** The top-level field at a boundary, in the key's direction. */
const getFieldAt = (
  document: ProseMirrorNode,
  boundary: number,
  forward: boolean
): AdjacentField | null => {
  const $pos = document.resolve(boundary);
  const node = forward ? $pos.nodeAfter : $pos.nodeBefore;

  if (!node || !isField(node)) return null;

  return { node, pos: forward ? boundary : boundary - node.nodeSize };
};
/** The top-level field next to a gap cursor or a top-level paragraph's edge, in the key's direction. */
const getAdjacentField = (selection: Selection, forward: boolean): AdjacentField | null => {
  const { $from, empty } = selection;
  const atParagraphEdge =
    empty &&
    $from.depth === 1 &&
    $from.parent.type.name === "paragraph" &&
    $from.parentOffset === (forward ? $from.parent.content.size : 0);

  if (selection instanceof GapCursor && $from.depth === 0) {
    return getFieldAt($from.doc, $from.pos, forward);
  }

  if (atParagraphEdge) {
    return getFieldAt($from.doc, forward ? $from.after() : $from.before(), forward);
  }

  return null;
};
/**
 * Backspace and Delete next to a top-level field: an empty paragraph between blocks goes first,
 * then the field is selected, so that the next press deletes it, where it's allowed.
 */
const getDeletion = (state: EditorState, forward: boolean): Transaction | null => {
  const { selection, tr } = state;
  const { $from } = selection;
  const field = getAdjacentField(selection, forward);
  const removesParagraph =
    !(selection instanceof GapCursor) &&
    $from.parent.content.size === 0 &&
    $from.index(0) < state.doc.childCount - 1;

  if (!field) return null;
  if (field.node.attrs.inherited) return tr;

  if (removesParagraph) {
    const boundary = $from.before();
    const fieldPos = forward ? boundary : field.pos;

    tr.delete(boundary, $from.after());

    // As without the paragraph: a property is selected, a fragment entered on the key's side.
    const nextSelection =
      field.node.type.name === "property"
        ? NodeSelection.create(tr.doc, fieldPos)
        : Selection.findFrom(tr.doc.resolve(boundary), forward ? 1 : -1);

    return nextSelection ? tr.setSelection(nextSelection) : tr;
  }

  return tr.setSelection(NodeSelection.create(state.doc, field.pos));
};
/** The start of a selected fragment's content. */
const getFragmentEntry = (selection: Selection): Selection | null => {
  const selectedFragment =
    selection instanceof NodeSelection && selection.node.type.name === "fragment";

  return selectedFragment
    ? Selection.findFrom(selection.$from.doc.resolve(selection.from + 1), 1)
    : null;
};
/**
 * Where an arrow key moves onto, past or into a top-level field; null leaves it to the editor.
 * Fragments are selected via their headers, so from above and from their top blocks.
 */
const getArrowSelection = (view: EditorView, direction: ArrowDirection): Selection | null => {
  const { doc, selection } = view.state;
  const { $head, empty } = selection;
  const forward = direction === "down" || direction === "right";
  const bias = forward ? 1 : -1;
  const selectedField =
    selection instanceof NodeSelection && selection.$from.depth === 0 && isField(selection.node);

  let boundary: number | null = null;

  if (selectedField && forward && selection.node.type.name === "fragment") {
    return getFragmentEntry(selection);
  }

  if (selectedField) {
    boundary = forward ? selection.to : selection.from;
  } else if (selection instanceof GapCursor) {
    boundary = $head.depth === 0 ? $head.pos : null;
  } else if (empty && $head.parent.isTextblock && view.endOfTextblock(direction)) {
    const next = Selection.findFrom(doc.resolve(forward ? $head.after() : $head.before()), bias);
    const leavesBlock = !next || next.$head.index(0) !== $head.index(0);
    const leavesFragmentTop = leavesBlock && !forward && $head.node(1).type.name === "fragment";

    if (leavesFragmentTop) return NodeSelection.create(doc, $head.before(1));
    if (leavesBlock) boundary = forward ? $head.after(1) : $head.before(1);
  }

  if (boundary === null) return null;

  const field = getFieldAt(doc, boundary, forward);
  const entersFragmentEnd = !forward && field?.node.type.name === "fragment";

  if (field?.node.attrs.inherited) return null;
  if (entersFragmentEnd) return Selection.findFrom(doc.resolve(boundary), -1);
  if (field) return NodeSelection.create(doc, field.pos);

  return selectedField ? Selection.findFrom(doc.resolve(boundary), bias) : null;
};
/** Escape inside a fragment selects it, to go on with the arrow keys. */
const getFragmentSelection = (selection: Selection): Selection | null => {
  const { $head } = selection;
  const inFragment = $head.depth > 0 && $head.node(1).type.name === "fragment";

  return inFragment ? NodeSelection.create($head.doc, $head.before(1)) : null;
};
/** Enter on a selected property edits its value. */
const focusPropertyValue = (view: EditorView): boolean => {
  const { selection } = view.state;
  const selectedProperty =
    selection instanceof NodeSelection && selection.node.type.name === "property";
  const dom = selectedProperty ? view.nodeDOM(selection.from) : null;
  const control =
    dom instanceof HTMLElement
      ? dom
          .querySelector("[data-property-value]")
          ?.querySelector<HTMLElement>(
            "input, [contenteditable]:not([contenteditable='false']), button, [tabindex='0']"
          )
      : null;

  control?.focus();

  return Boolean(control);
};
/** Keys around top-level properties and fragments: selecting, entering, leaving and deleting them. */
const FieldKeyboard = Extension.create({
  name: "fieldKeyboard",
  // Before the gap cursor, so arrow keys select fields rather than the gaps next to them.
  priority: 101,
  addKeyboardShortcuts() {
    const { editor } = this;
    // After the key press, as Chrome moves a property's node selection made during it.
    const updateAfterKey = (getTransaction: () => Transaction | null): boolean => {
      if (!getTransaction()) return false;

      setTimeout(() => {
        const transaction = editor.isDestroyed ? null : getTransaction();

        if (transaction) editor.view.dispatch(transaction);
      });

      return true;
    };
    const select = (getSelection: () => Selection | null): boolean => {
      return updateAfterKey(() => {
        const selection = getSelection();

        return selection && editor.state.tr.setSelection(selection);
      });
    };
    const deleteTowardField = (forward: boolean) => () => {
      return updateAfterKey(() => getDeletion(editor.state, forward));
    };
    const moveByArrow = (direction: ArrowDirection) => () => {
      return select(() => getArrowSelection(editor.view, direction));
    };

    return {
      Backspace: deleteTowardField(false),
      Delete: deleteTowardField(true),
      ArrowUp: moveByArrow("up"),
      ArrowDown: moveByArrow("down"),
      ArrowLeft: moveByArrow("left"),
      ArrowRight: moveByArrow("right"),
      Enter: () => {
        return (
          focusPropertyValue(editor.view) || select(() => getFragmentEntry(editor.state.selection))
        );
      },
      Escape: () => select(() => getFragmentSelection(editor.state.selection))
    };
  }
});

export { FieldKeyboard };
