import { isPositionInInheritedField } from "../../ui/block-utils";
import { CodeBlock as BaseCodeBlock } from "@andesine/document/tiptap";
import type { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";

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

/** The open depth of a slice's side with its code block closed, so the code doesn't merge. */
const getClosedDepth = (slice: Slice, open: number, side: "firstChild" | "lastChild"): number => {
  let node = slice.content[side];

  for (let depth = 0; node && depth < open; depth += 1) {
    if (node.type.name === "codeBlock") return depth;

    node = node[side];
  }

  return open;
};

const CodeBlock = BaseCodeBlock.extend({
  // A gap cursor goes between code blocks, else nothing can be added between two of them.
  extendNodeSchema(extension) {
    return extension.name === "codeBlock" ? { createGapCursor: true } : {};
  },
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      "Mod-Enter": () => leaveCodeBlock(this.editor)
    };
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          // A copied part of a code block stays one wherever it's pasted, except in another.
          transformPasted(slice, view) {
            const { $from } = view.state.selection;
            const { codeBlock } = view.state.schema.nodes;
            const depth = Math.max(0, $from.depth - 1);
            const container = $from.node(depth);
            const allowedBlocks = container.attrs.allowedBlocks as string[] | undefined;
            const canHoldCode =
              (allowedBlocks?.includes("codeBlock") ?? true) &&
              container.canReplaceWith($from.index(depth), $from.indexAfter(depth), codeBlock);

            if ($from.parent.type === codeBlock || !canHoldCode) return slice;

            return new Slice(
              slice.content,
              getClosedDepth(slice, slice.openStart, "firstChild"),
              getClosedDepth(slice, slice.openEnd, "lastChild")
            );
          }
        }
      })
    ];
  }
}).configure({ exitOnTripleEnter: false, enableTabIndentation: true, tabSize: 2 });

export { CodeBlock, leaveCodeBlock };
