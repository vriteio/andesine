import { isPositionInInheritedField } from "../../ui/block-utils";
import { CodeBlock as BaseCodeBlock } from "@tiptap/extension-code-block";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

const leaveCodeBlock = (editor: Editor): boolean => {
  const { state, view } = editor;
  const { $head } = state.selection;

  if (
    !editor.isEditable ||
    $head.parent.type.name !== "codeBlock" ||
    isPositionInInheritedField(state.doc, $head.pos)
  )
    return false;

  const after = $head.after();
  const next = state.doc.nodeAt(after);
  const tr = state.tr;

  if (next?.type.name !== "paragraph") {
    const paragraph = state.schema.nodes.paragraph;
    const $after = state.doc.resolve(after);

    if (!$after.parent.canReplaceWith($after.index(), $after.index(), paragraph)) return false;

    tr.insert(after, paragraph.create());
  }
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
  view.focus();
  return true;
};

const CodeBlock = BaseCodeBlock.extend({
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-Enter": () => leaveCodeBlock(this.editor)
    };
  }
}).configure({ exitOnTripleEnter: false, enableTabIndentation: true, tabSize: 2 });

export { CodeBlock, leaveCodeBlock };
