import type { MenuItem } from "@andesine/components";
import { nanoid } from "nanoid";
import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { isPositionInInheritedField } from "../../block-utils";

const duplicateContent = (node: JSONContent): JSONContent => {
  return {
    ...node,
    attrs:
      node.type === "text" || node.type === "hardBreak"
        ? node.attrs
        : { ...node.attrs, id: nanoid() },
    content: node.content?.map(duplicateContent)
  };
};

const createElementMenuItems = (editor: Editor): MenuItem[] => {
  const { selection, doc } = editor.state;
  const node = doc.nodeAt(selection.from);
  const commit = () => {
    const dom = editor.view.nodeDOM(selection.from);
    if (dom instanceof HTMLElement) {
      dom.dispatchEvent(new Event("element-commit"));
    }
  };

  if (!editor.isEditable || isPositionInInheritedField(doc, selection.from)) {
    return [];
  }

  if (node?.type.name === "element" && selection.to === selection.from + node.nodeSize) {
    const dom = editor.view.nodeDOM(selection.from);
    if (dom instanceof HTMLElement && dom.hasAttribute("data-element-locked")) {
      return [];
    }
    return [
      {
        label: "Edit tag",
        icon: "i-lucide:code-xml",
        onClick: () => editor.commands.editElement(selection.from)
      },
      {
        label: "Format tag",
        icon: "i-lucide:align-left",
        shortcut: "$mod+shift+f",
        onClick: () => editor.commands.formatElementTag(selection.from)
      },
      ...(node.attrs.selfClosing
        ? [
            {
              label: "Add content",
              icon: "i-lucide:plus",
              onClick: () => {
                commit();
                return editor.chain().addElementContent(selection.from).focus().run();
              }
            }
          ]
        : []),
      {
        label: "Duplicate",
        icon: "i-lucide:copy-plus",
        onClick: () => {
          commit();
          const current = editor.state.doc.nodeAt(selection.from);
          return current?.type.name === "element"
            ? editor
                .chain()
                .insertContentAt(
                  selection.from + current.nodeSize,
                  duplicateContent(structuredClone(current.toJSON()))
                )
                .focus()
                .run()
            : false;
        }
      },
      {
        label: "Unwrap",
        icon: "i-lucide:ungroup",
        onClick: () => {
          commit();
          return editor.chain().unwrapElement(selection.from).focus().run();
        }
      }
    ];
  }
  if (!editor.can().wrapInElement()) {
    return [];
  }
  return [
    {
      label: "Wrap in Element",
      icon: "i-lucide:code-xml",
      onClick: () => editor.chain().wrapInElement().run()
    }
  ];
};

export { createElementMenuItems };
