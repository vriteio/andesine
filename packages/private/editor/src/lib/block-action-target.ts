import {
  ELEMENT_BLOCKS,
  findDisallowedElementBlock,
  normalizeElementAttributes,
  type ElementContent
} from "@andesine/document";
import type { Editor, EditorEvents, JSONContent } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { BlockActionTarget } from "../client-types";
import {
  forEachSelectedBlock,
  isPositionInInheritedField,
  rangeContainsInheritedField
} from "../ui/block-utils";

interface SelectedBlock {
  node: ProseMirrorNode;
  pos: number;
}

const MAX_CONTENT_SIZE = 100_000;

/** The selected sibling blocks, or null when the selection is not one run of sibling blocks. */
const getSelectedBlocks = (editor: Editor): SelectedBlock[] | null => {
  const { doc, selection } = editor.state;
  const blocks: SelectedBlock[] = [];

  forEachSelectedBlock(doc, selection.from, selection.to, (node, pos) => {
    blocks.push({ node, pos });
  });

  const isSiblingRun = blocks.every((block, index) => {
    const previous = blocks[index - 1];

    return !previous || previous.pos + previous.node.nodeSize === block.pos;
  });

  return blocks.length && isSiblingRun ? blocks : null;
};
/**
 * IDs of new nodes come from the editor, never from extension content. Elements get their tag
 * source from their attributes; `props` defaults to none, and `selfClosing` to having no content.
 */
const toEditorContent = (content: JSONContent): JSONContent => {
  const { id: _id, ...attrs } = content.attrs ?? {};
  const children = content.content?.map(toEditorContent);
  const isElement = content.type === "element";

  return {
    ...content,
    ...((content.attrs || isElement) && {
      attrs: isElement
        ? normalizeElementAttributes({ props: {}, selfClosing: !children?.length, ...attrs })
        : attrs
    }),
    ...(children && { content: children })
  };
};
const getAllowedBlocks = (doc: ProseMirrorNode, pos: number): readonly string[] => {
  const $pos = doc.resolve(pos);

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const ancestor = $pos.node(depth);

    if (ancestor.type.name === "fragment") return ancestor.attrs.allowedBlocks || ELEMENT_BLOCKS;
  }

  return ELEMENT_BLOCKS;
};
/** Edits apply only to unchanged blocks outside inherited fields, with content allowed there. */
const createBlockActionTarget = (editor: Editor, blocks: SelectedBlock[]): BlockActionTarget => {
  const last = blocks[blocks.length - 1];

  let from = blocks[0].pos;
  let to = last.pos + last.node.nodeSize;
  let snapshot = editor.state.doc.slice(from, to).content;
  let released = false;
  let applying = false;

  const track = ({ transaction }: EditorEvents["transaction"]) => {
    if (applying || !transaction.docChanged) return;

    const start = transaction.mapping.mapResult(from, 1);
    const end = transaction.mapping.mapResult(to, -1);

    from = start.pos;
    to = end.pos;
    released ||= start.deleted || end.deleted || from >= to;
  };
  const toFragment = (content: JSONContent[]): Fragment | null => {
    const doc = editor.state.doc;
    const allowed = getAllowedBlocks(doc, from);

    try {
      const isAllowed =
        JSON.stringify(content).length <= MAX_CONTENT_SIZE &&
        !findDisallowedElementBlock(content as ElementContent[], allowed);
      const nodes = isAllowed
        ? content.map((item) => editor.schema.nodeFromJSON(toEditorContent(item)))
        : [];

      nodes.forEach((node) => node.check());

      return nodes.length ? Fragment.fromArray(nodes) : null;
    } catch {
      return null;
    }
  };
  const apply = (content: JSONContent[], replace: boolean): boolean => {
    const { doc } = editor.state;
    const isUnchanged = !released && doc.slice(from, to).content.eq(snapshot);
    const isEditable =
      editor.isEditable &&
      !isPositionInInheritedField(doc, from) &&
      !rangeContainsInheritedField(doc, from, to);
    const fragment = isUnchanged && isEditable ? toFragment(content) : null;

    if (!fragment) return false;

    const $from = doc.resolve(from);
    const start = $from.index();
    const end = start + snapshot.childCount;

    if (!$from.parent.canReplace(replace ? start : end, end, fragment)) return false;

    applying = true;

    try {
      editor.view.dispatch(
        replace
          ? editor.state.tr.replaceWith(from, to, fragment)
          : editor.state.tr.insert(to, fragment)
      );
    } finally {
      applying = false;
    }

    // Read back from the document, which plugins may have normalized in the same dispatch.
    if (replace) {
      to = from + fragment.size;
      snapshot = editor.state.doc.slice(from, to).content;
    }

    return true;
  };

  editor.on("transaction", track);

  return {
    // Plain JSON: extensions send blocks back, and their protocol rejects `undefined` attributes.
    blocks: blocks.map(({ node }) => JSON.parse(JSON.stringify(node.toJSON())) as JSONContent),
    replace: (content) => apply(content, true),
    insertAfter: (content) => apply(content, false),
    getRect() {
      if (released || editor.isDestroyed) return null;

      const last = editor.state.doc.resolve(to).nodeBefore;
      const elements = [editor.view.nodeDOM(from), last && editor.view.nodeDOM(to - last.nodeSize)]
        .filter((element) => element instanceof HTMLElement)
        .map((element) => element.getBoundingClientRect());

      if (!elements.length) return null;

      const left = Math.min(...elements.map((rect) => rect.left));
      const top = Math.min(...elements.map((rect) => rect.top));

      return new DOMRect(
        left,
        top,
        Math.max(...elements.map((rect) => rect.right)) - left,
        Math.max(...elements.map((rect) => rect.bottom)) - top
      );
    },
    release() {
      released = true;
      editor.off("transaction", track);
    }
  };
};

export { createBlockActionTarget, getSelectedBlocks };
