import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorSchemaField } from "#editor/client-types";
import type { SchemaConstraintsOptions } from "#editor/extensions/schema-constraints";

const getSchemaConstraints = (editor: Editor): SchemaConstraintsOptions | undefined => {
  return editor.extensionManager.extensions.find(({ name }) => name === "schemaConstraints")
    ?.options;
};
const getSchemaFields = (editor: Editor): EditorSchemaField[] => {
  return getSchemaConstraints(editor)?.fields() ?? [];
};
const isOptionalField = (editor: Editor, fieldID: string | null | undefined): boolean => {
  return getSchemaFields(editor).some(({ id, optional }) => optional && id === fieldID);
};
/** An entry's schema field that the entry can't remove. */
const isRequiredEntryField = (editor: Editor, node: ProseMirrorNode): boolean => {
  const isSchemaField =
    ["property", "fragment"].includes(node.type.name) &&
    typeof node.attrs.schemaFieldID === "string";

  return (
    isSchemaField &&
    getSchemaConstraints(editor)?.mode === "entry" &&
    !isOptionalField(editor, node.attrs.schemaFieldID)
  );
};
/** The required entry fields that the selection fully covers. */
const getSelectedRequiredFields = (editor: Editor): ProseMirrorNode[] => {
  const { doc, selection } = editor.state;
  const fields: ProseMirrorNode[] = [];

  doc.nodesBetween(selection.from, selection.to, (node, pos) => {
    const covered = pos >= selection.from && pos + node.nodeSize <= selection.to;

    if (covered && isRequiredEntryField(editor, node)) fields.push(node);

    return false;
  });

  return fields;
};
const getUnusedOptionalFields = (
  fields: EditorSchemaField[],
  document: ProseMirrorNode
): EditorSchemaField[] => {
  const usedFieldIDs = new Set<unknown>();

  document.forEach((node) => usedFieldIDs.add(node.attrs.schemaFieldID));

  return fields.filter(({ id, optional }) => optional && !usedFieldIDs.has(id));
};
const createFieldNode = (schema: Schema, field: EditorSchemaField): ProseMirrorNode => {
  if (field.kind === "fragment") {
    return schema.nodeFromJSON({
      type: "fragment",
      attrs: { schemaFieldID: field.id, name: field.label, allowedBlocks: field.allowedBlocks },
      content: field.initialContent
    });
  }

  return schema.nodeFromJSON({
    type: "property",
    attrs: {
      schemaFieldID: field.id,
      label: field.label,
      type: field.type,
      options: field.options,
      value: field.initialValue
    }
  });
};
/** Inserts the field at its schema position, wherever the cursor is. */
const insertOptionalField = (
  transaction: Transaction,
  fields: EditorSchemaField[],
  field: EditorSchemaField
): void => {
  const order = fields.map(({ id }) => id);
  const node = createFieldNode(transaction.doc.type.schema, field);

  let position: number | null = null;

  transaction.doc.forEach((child, offset) => {
    const follows =
      child.type.name === "paragraph" ||
      order.indexOf(child.attrs.schemaFieldID) > order.indexOf(field.id);

    if (follows && position === null) position = offset;
  });

  const insertPosition = position ?? transaction.doc.content.size;

  transaction.insert(insertPosition, node);

  if (field.kind === "fragment") {
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertPosition + 1)));
  }
};

export {
  getSchemaFields,
  getSelectedRequiredFields,
  getUnusedOptionalFields,
  insertOptionalField,
  isOptionalField,
  isRequiredEntryField
};
