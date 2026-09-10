import { nanoid } from "nanoid";
import { InputRule, Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection, Selection, TextSelection } from "@tiptap/pm/state";
import {
  Fragment,
  type DOMOutputSpec,
  type Node as ProseMirrorNode,
  type ResolvedPos
} from "@tiptap/pm/model";
import {
  ELEMENT_BLOCKS,
  findDisallowedElementBlock,
  formatElement,
  normalizeElementAttributes,
  parseElement,
  type ElementData
} from "../../lib/element";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    element: {
      insertElement(): ReturnType;
      wrapInElement(): ReturnType;
      editElement(position?: number, selectName?: boolean, edge?: "start" | "end"): ReturnType;
      formatElementTag(position?: number): ReturnType;
      addElementContent(position?: number): ReturnType;
      unwrapElement(position?: number): ReturnType;
    };
  }
}

const allowsElement = ($position: ResolvedPos, content: ProseMirrorNode[] = []): boolean => {
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const ancestor = $position.node(depth);

    if (ancestor.type.name === "fragment") {
      return !findDisallowedElementBlock(
        [{ type: "element", content: content.map((node) => node.toJSON()) }],
        ancestor.attrs.allowedBlocks || ELEMENT_BLOCKS
      );
    }
  }

  let schemaControlled = false;

  $position.doc.forEach((node) => {
    if (["fragment", "property"].includes(node.type.name) && node.attrs.schemaFieldID) {
      schemaControlled = true;
    }
  });
  return !schemaControlled;
};

const Element = Node.create({
  name: "element",
  group: "block",
  content: `(${ELEMENT_BLOCKS.join(" | ")})*`,
  defining: true,
  isolating: true,
  selectable: true,
  addAttributes() {
    return {
      name: { default: "Element", rendered: false },
      props: { default: {}, rendered: false },
      selfClosing: { default: true, rendered: false },
      source: { default: "<Element />", rendered: false }
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="element"]',
        contentElement: "[data-element-content]",
        getAttrs: (dom) => {
          try {
            return normalizeElementAttributes(JSON.parse(dom.getAttribute("data-element") || "{}"));
          } catch {
            return false;
          }
        }
      }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = normalizeElementAttributes(node.attrs);

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "element",
        "data-element": JSON.stringify(attrs)
      }),
      ["span", { "data-element-tag": "opening" }, attrs.source],
      ["div", { "data-element-content": "" }, 0],
      ...(!node.attrs.selfClosing
        ? [["span", { "data-element-tag": "closing" }, `</${node.attrs.name}>`]]
        : [])
    ] as DOMOutputSpec;
  },
  addCommands() {
    return {
      insertElement:
        () =>
        ({ tr, dispatch }) => {
          const { $from } = tr.selection;
          const id = nanoid();
          const node = this.type.create({ id });

          if ($from.parent.type.name !== "paragraph" || !allowsElement($from)) {
            return false;
          }
          const parent = $from.node($from.depth - 1);
          const index = $from.index($from.depth - 1);

          if (!parent.canReplaceWith(index, index + 1, this.type)) {
            return false;
          }
          if (dispatch) {
            if ($from.parent.type.name === "paragraph" && !$from.parent.content.size) {
              tr.replaceWith($from.before(), $from.after(), node);
            } else {
              tr.replaceSelectionWith(node);
            }
            tr.doc.descendants((child, position) => {
              if (child.attrs.id !== id) {
                return;
              }
              tr.setSelection(NodeSelection.create(tr.doc, position));
              tr.setMeta("elementEdit", { position, selectName: true });
            });
          }
          return true;
        },
      editElement:
        (position, selectName = false, edge) =>
        ({ editor, tr, dispatch }) => {
          const pos = position ?? editor.state.selection.from;
          const dom = editor.view.nodeDOM(pos);

          if (
            !editor.isEditable ||
            editor.state.doc.nodeAt(pos)?.type.name !== "element" ||
            !(dom instanceof HTMLElement) ||
            dom.hasAttribute("data-element-locked")
          ) {
            return false;
          }
          if (dispatch) {
            tr.setSelection(NodeSelection.create(tr.doc, pos));
            tr.setMeta("elementEdit", { position: pos, selectName, edge });
          }
          return true;
        },
      formatElementTag:
        (position) =>
        ({ editor, tr, dispatch }) => {
          const pos = position ?? tr.selection.from;
          const node = tr.doc.nodeAt(pos);
          const dom = editor.view.nodeDOM(pos);

          if (
            node?.type.name !== "element" ||
            (dom instanceof HTMLElement && dom.hasAttribute("data-element-locked"))
          ) {
            return false;
          }
          if (!dispatch) {
            return true;
          }
          if (dom instanceof HTMLElement && dom.hasAttribute("data-element-editing")) {
            dom.dispatchEvent(new Event("element-format"));
          } else {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              source: formatElement(parseElement(node.attrs.source))
            });
          }
          return true;
        },
      addElementContent:
        (position) =>
        ({ tr, dispatch }) => {
          const pos = position ?? tr.selection.from;
          const node = tr.doc.nodeAt(pos);

          if (node?.type.name !== "element" || !node.attrs.selfClosing) {
            return false;
          }
          if (dispatch) {
            const attrs = normalizeElementAttributes({ ...node.attrs, selfClosing: false });
            const paragraph = tr.doc.type.schema.nodes.paragraph.create();

            tr.replaceWith(pos, pos + node.nodeSize, node.type.create(attrs, paragraph));
            tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView();
          }
          return true;
        },
      unwrapElement:
        (position) =>
        ({ tr, dispatch }) => {
          const pos = position ?? tr.selection.from;
          const node = tr.doc.nodeAt(pos);

          if (node?.type.name !== "element") {
            return false;
          }
          if (dispatch) {
            tr.replaceWith(
              pos,
              pos + node.nodeSize,
              node.content.size ? node.content : tr.doc.type.schema.nodes.paragraph.create()
            );
          }
          return true;
        },
      wrapInElement:
        () =>
        ({ tr, dispatch }) => {
          const { $from, $to } = tr.selection;
          const range = $from.blockRange($to);

          if (!range) {
            return false;
          }

          const children: ProseMirrorNode[] = [];

          for (let index = range.startIndex; index < range.endIndex; index += 1) {
            children.push(range.parent.child(index));
          }
          const content = Fragment.from(children);
          const data: ElementData = { name: "Element", props: {}, selfClosing: false };

          if (
            !this.type.validContent(content) ||
            !allowsElement($from, children) ||
            !range.parent.canReplaceWith(range.startIndex, range.endIndex, this.type)
          ) {
            return false;
          }
          if (dispatch) {
            tr.replaceWith(
              range.start,
              range.end,
              this.type.create({ ...data, id: nanoid(), source: formatElement(data) }, content)
            );
            tr.setSelection(NodeSelection.create(tr.doc, range.start));
            tr.setMeta("elementEdit", { position: range.start, selectName: true });
          }
          return true;
        }
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-f": () => this.editor.commands.formatElementTag(),
      "Enter": () => {
        const { selection } = this.editor.state;

        return selection instanceof NodeSelection && selection.node.type.name === "element"
          ? this.editor.commands.editElement()
          : false;
      },
      "Backspace": () => {
        const { state, view } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        if (!selection.empty || $from.parentOffset !== 0) {
          return false;
        }
        for (let depth = $from.depth - 1; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name !== "element") {
            continue;
          }
          if ($from.pos !== $from.start(depth) + 1) {
            return false;
          }
          view.dispatch(
            state.tr.setSelection(NodeSelection.create(state.doc, $from.before(depth)))
          );
          return true;
        }
        return false;
      }
    };
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^<[\s\S]*>$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const $from = tr.doc.resolve(range.from);
          let data: ElementData;

          if (
            $from.parent.type.name !== "paragraph" ||
            $from.parentOffset !== 0 ||
            range.to !== $from.end()
          ) {
            return null;
          }
          try {
            data = parseElement(match[0]);
          } catch {
            return null;
          }

          const node = this.type.create(
            { ...data, id: nanoid(), source: formatElement(data) },
            data.selfClosing ? undefined : state.schema.nodes.paragraph.create()
          );
          const pos = $from.before();

          const parent = $from.node($from.depth - 1);
          const index = $from.index($from.depth - 1);

          if (!allowsElement($from) || !parent.canReplaceWith(index, index + 1, this.type)) {
            return null;
          }

          tr.replaceWith(pos, $from.after(), node);
          tr.setSelection(
            data.selfClosing
              ? NodeSelection.create(tr.doc, pos)
              : Selection.near(tr.doc.resolve(pos + 1))
          );
        }
      })
    ];
  }
});

export { Element };
