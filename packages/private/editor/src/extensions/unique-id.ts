import { UniqueID as BaseUniqueID } from "@tiptap/extension-unique-id";
import { DOCUMENT_ID_NODE_TYPES } from "@andesine/document/tiptap";
import { nanoid } from "nanoid";

const UniqueID = BaseUniqueID.extend({
  addGlobalAttributes() {
    return [];
  }
}).configure({
  attributeName: "id",
  types: [...DOCUMENT_ID_NODE_TYPES],
  generateID: () => nanoid()
});

export { UniqueID };
