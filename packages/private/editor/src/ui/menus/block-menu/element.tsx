import type { MenuItem } from "@andesine/components";
import type { ElementViews } from "#editor/client-types";
import {
  cleanUpElement,
  getElementAncestors,
  getMisplacedParents,
  getRejectedChildren
} from "#editor/lib/element-content";
import { ElementPropsForm, type ElementPropsSources } from "./element-props";
import { isSourceShown, toggleSourceShown } from "#editor/ui/views/element-view/source-mode";
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

/** Element actions; with a props schema, the props form comes first, as image fields do. */
const createElementMenuItems = (
  editor: Editor,
  elementViews: ElementViews | undefined,
  sources: ElementPropsSources
): NonNullable<MenuItem["items"]> => {
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

    const ancestors = getElementAncestors(doc, selection.from);
    const schema = elementViews?.schema(node.attrs.name, ancestors);
    const hasView = Boolean(elementViews?.resolve(node.attrs.name, ancestors));
    const sourceShown = isSourceShown(node.attrs.id);
    const hasRejected = Boolean(
      elementViews && getRejectedChildren(doc, selection.from, elementViews).length
    );
    const isMisplaced = Boolean(
      elementViews && getMisplacedParents(doc, selection.from, elementViews)
    );
    // For this session: the element's tags in place of its view, or back; a group of its own.
    const viewItems: MenuItem[] = hasView
      ? [
          {
            label: sourceShown ? "Show element view" : "Show tags",
            icon: sourceShown ? "i-lucide:layout-template" : "i-lucide:square-code",
            onClick: () => toggleSourceShown(node.attrs.id)
          }
        ]
      : [];
    const actions: MenuItem[] = [
      {
        label: "Edit tag",
        icon: "i-lucide:code-xml",
        onClick: () => editor.commands.editElement(selection.from)
      },
      // Puts a misplaced element where it belongs, else wraps or moves out the blocks that the
      // element's content rules don't accept.
      ...(isMisplaced || hasRejected
        ? [
            {
              label: isMisplaced ? "Clean up placement" : "Clean up content",
              icon: "i-lucide:wand-sparkles",
              onClick: () => cleanUpElement(editor, selection.from, elementViews!)
            }
          ]
        : []),
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
        : [
            {
              label: "Unwrap",
              icon: "i-lucide:ungroup",
              onClick: () => {
                commit();
                return editor.chain().unwrapElement(selection.from).focus().run();
              }
            }
          ]),
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
      }
    ];

    const form = schema?.length
      ? [
          () => (
            <ElementPropsForm
              editor={editor}
              elementID={node.attrs.id}
              schema={schema}
              links={sources.links}
              icons={sources.icons}
            />
          )
        ]
      : [];

    // Empty groups are left out, with their dividers.
    return [form, viewItems, actions];
  }

  return [];
};

export { createElementMenuItems };
