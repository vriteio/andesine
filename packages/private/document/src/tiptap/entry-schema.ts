import { getSchema } from "@tiptap/core";
import type { ContentNode } from "../types";
import { Blockquote } from "@tiptap/extension-blockquote";
import { BulletList } from "@tiptap/extension-bullet-list";
import { CodeBlock } from "@tiptap/extension-code-block";
import { Code } from "@tiptap/extension-code";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Highlight } from "@tiptap/extension-highlight";
import { OrderedList } from "@tiptap/extension-ordered-list";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Strike } from "@tiptap/extension-strike";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TaskList } from "@tiptap/extension-task-list";
import { Text } from "@tiptap/extension-text";
import { Element } from "./blocks/element";
import { Heading } from "./blocks/heading";
import { HorizontalRule } from "./blocks/horizontal-rule";
import { Image } from "./blocks/image";
import { ListItem } from "./blocks/lists/list-item";
import { TaskItem } from "./blocks/lists/task-item";
import { Table, TableCell, TableHeader, TableRow } from "./blocks/table";
import { EntryDocument } from "./document";
import { Fragment } from "./fragment";
import { DOCUMENT_ID_NODE_TYPES, DocumentIDs } from "./ids";
import { Bold } from "./marks/bold";
import { Italic } from "./marks/italic";
import { Link } from "./marks/link";
import { Property } from "./property";
import { Title } from "./title";

const ID_NODE_TYPES = new Set<string>(DOCUMENT_ID_NODE_TYPES);
const entryDocumentSchema = getSchema([
  EntryDocument,
  Title,
  Property,
  Fragment,
  Paragraph,
  Text,
  HardBreak,
  Heading,
  Blockquote,
  BulletList,
  OrderedList,
  TaskList,
  TaskItem,
  ListItem,
  HorizontalRule,
  CodeBlock,
  Image,
  Element,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  DocumentIDs,
  Bold,
  Code,
  Italic,
  Highlight,
  Strike,
  Link,
  Subscript,
  Superscript
]);

/**
 * Checks an entry document against the editor schema and applies the editor's own
 * normalization (node IDs, trailing paragraph), so opening it in the editor changes nothing.
 * @throws RangeError or SyntaxError when the document doesn't match the schema.
 */
const normalizeEntryDocument = (content: ContentNode): ContentNode => {
  const node = entryDocumentSchema.nodeFromJSON(content);
  const document = node.toJSON() as ContentNode;
  const ids = new Set<string>();
  const assignIDs = (child: ContentNode): void => {
    const id = child.attrs?.id;

    if (ID_NODE_TYPES.has(child.type)) {
      const hasUniqueID = typeof id === "string" && id && !ids.has(id);

      child.attrs = { ...child.attrs, id: hasUniqueID ? id : crypto.randomUUID() };
      ids.add(child.attrs.id as string);
    }

    child.content?.forEach(assignIDs);
  };
  const blocks = document.content || [];
  const last = blocks[blocks.length - 1];
  const hasSchemaFields = blocks.some((block) => {
    return (
      ["fragment", "property"].includes(block.type) &&
      typeof block.attrs?.schemaFieldID === "string"
    );
  });

  node.check();
  assignIDs(document);

  const emptyTrailingParagraph = last?.type === "paragraph" && !last.content?.length;

  // The same rule as the editor's trailing node in entry mode.
  if (hasSchemaFields && emptyTrailingParagraph) {
    blocks.pop();
  } else if (!hasSchemaFields && last?.type !== "paragraph") {
    blocks.push({ type: "paragraph", attrs: { id: crypto.randomUUID() } });
  }

  return { ...document, content: blocks };
};

export { entryDocumentSchema, normalizeEntryDocument };
