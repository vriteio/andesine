import { UniqueID as BaseUniqueID } from "@tiptap/extension-unique-id";
import { nanoid } from "nanoid";

const UniqueID = BaseUniqueID.configure({
  attributeName: "id",
  types: [
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
  ],
  generateID: () => nanoid()
});

export { UniqueID };
