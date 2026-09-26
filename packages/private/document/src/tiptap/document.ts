import { Document as BaseDocument } from "@tiptap/extension-document";

const EntryDocument = BaseDocument.extend({
  content: "title (block | tableBlock | property | fragment)+"
});
const CollectionSchemaDocument = BaseDocument.extend({
  content: "(paragraph | property | fragment)+"
});

export { EntryDocument, CollectionSchemaDocument };
