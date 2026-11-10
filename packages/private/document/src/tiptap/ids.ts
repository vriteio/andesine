import { Extension } from "@tiptap/core";

const DOCUMENT_ID_NODE_TYPES = [
  "paragraph",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "horizontalRule",
  "codeBlock",
  "element",
  "image",
  "heading",
  "fragment",
  "property",
  "listItem",
  "taskItem",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader"
] as const;

const DocumentIDs = Extension.create({
  name: "documentIDs",
  priority: 10000,
  addGlobalAttributes() {
    return [
      {
        types: [...DOCUMENT_ID_NODE_TYPES],
        attributes: {
          id: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-id"),
            renderHTML: (attributes) => (attributes.id ? { "data-id": attributes.id } : {})
          }
        }
      }
    ];
  }
});

export { DOCUMENT_ID_NODE_TYPES, DocumentIDs };
