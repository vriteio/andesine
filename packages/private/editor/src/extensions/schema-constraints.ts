import {
  findDisallowedElementBlock,
  FRAGMENT_BLOCK_TYPES,
  type FragmentBlockType
} from "@andesine/document";
import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { GapCursor } from "@tiptap/pm/gapcursor";
import type { ResolvedPos } from "@tiptap/pm/model";
import { Plugin, Selection } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import type { EditorMode, EditorSchemaField } from "#editor/client-types";
import { isPositionInInheritedField, rangeContainsInheritedField } from "#editor/ui/block-utils";
import { isRequiredEntryField } from "#editor/lib/optional-fields";

interface SchemaConstraintsOptions {
  mode: EditorMode;
  fields(): EditorSchemaField[];
}
interface RootInspection {
  hasSchemaFields: boolean;
  invalidBlocks: number;
}

const isSchemaField = (node: ProseMirrorNode): boolean => {
  return node.type.name === "fragment" || node.type.name === "property";
};
/** Optional fields are left out, as entries can add and remove them. */
const getFieldStructure = (
  document: ProseMirrorNode,
  schemaFields: EditorSchemaField[]
): string => {
  const optionalFieldIDs = new Set(
    schemaFields.filter(({ optional }) => optional).map(({ id }) => id)
  );
  const fields: unknown[] = [];

  document.forEach((node) => {
    if (!isSchemaField(node) || optionalFieldIDs.has(node.attrs.schemaFieldID)) return;

    fields.push({
      kind: node.type.name,
      schemaFieldID: node.attrs.schemaFieldID,
      label: node.attrs.label,
      type: node.attrs.type,
      options: node.attrs.options,
      name: node.attrs.name,
      allowedBlocks: node.attrs.allowedBlocks
    });
  });

  return JSON.stringify(fields);
};
/** Each field at most once and in the schema's order, e.g. not a pasted copy of an optional one. */
const hasOrderedFields = (
  document: ProseMirrorNode,
  schemaFields: EditorSchemaField[]
): boolean => {
  const order = schemaFields.map(({ id }) => id);

  let lastIndex = -1;
  let ordered = true;

  document.forEach((node) => {
    if (!isSchemaField(node)) return;

    const index = order.indexOf(node.attrs.schemaFieldID);

    ordered &&= index > lastIndex;
    lastIndex = index;
  });

  return ordered;
};
const inspectRoot = (
  document: ProseMirrorNode,
  mode: EditorMode,
  schemaFields: EditorSchemaField[]
): RootInspection => {
  const addsFields = mode === "schema" || schemaFields.some(({ optional }) => optional);

  let hasSchemaFields = false;
  let invalidBlocks = 0;

  for (let index = 0; index < document.childCount; index += 1) {
    const node = document.child(index);
    const schemaField = isSchemaField(node);
    const isEntryTitle = mode === "entry" && index === 0 && node.type.name === "title";
    const isFieldPromptParagraph =
      addsFields &&
      index === document.childCount - 1 &&
      node.type.name === "paragraph" &&
      (!node.textContent || node.textContent.startsWith("/"));

    if (schemaField && typeof node.attrs.schemaFieldID === "string") {
      hasSchemaFields = true;
    }

    if (!isEntryTitle && !schemaField && !isFieldPromptParagraph) invalidBlocks += 1;
  }

  return { hasSchemaFields, invalidBlocks };
};
const hasValidFragmentBlocks = (document: ProseMirrorNode): boolean => {
  for (let index = 0; index < document.childCount; index += 1) {
    const node = document.child(index);

    if (node.type.name !== "fragment") continue;

    const allowedBlocks: readonly FragmentBlockType[] = Array.isArray(node.attrs.allowedBlocks)
      ? (node.attrs.allowedBlocks as FragmentBlockType[])
      : FRAGMENT_BLOCK_TYPES;

    if (findDisallowedElementBlock(node.content.toJSON() || [], allowedBlocks)) return false;
  }

  return true;
};
/** A gap only between required entry fields, where nothing can be added or removed. */
const isLockedGap = (editor: Editor, $pos: ResolvedPos): boolean => {
  const neighbors = [$pos.nodeBefore, $pos.nodeAfter].filter((node) => node !== null);

  return (
    $pos.depth === 0 &&
    neighbors.length > 0 &&
    neighbors.every((node) => isRequiredEntryField(editor, node))
  );
};
const SchemaConstraints = Extension.create<SchemaConstraintsOptions>({
  name: "schemaConstraints",
  addOptions() {
    return { mode: "schema", fields: () => [] };
  },
  addProseMirrorPlugins() {
    const { editor } = this;
    const { fields, mode } = this.options;

    return [
      new Plugin({
        // Clicks next to a locked gap keep the current selection.
        props: {
          handleClick(view, pos) {
            return isLockedGap(editor, view.state.doc.resolve(pos));
          },
          createSelectionBetween(view, $anchor, $head) {
            const locked = $anchor.pos === $head.pos && isLockedGap(editor, $head);

            return locked ? view.state.selection : null;
          }
        },
        // Arrow keys move past a locked gap, to the next text.
        appendTransaction(_transactions, oldState, state) {
          const { selection, tr } = state;

          const inLockedGap =
            selection instanceof GapCursor && isLockedGap(editor, selection.$head);

          if (!inLockedGap) return;

          const direction = selection.head >= oldState.selection.head ? 1 : -1;

          return tr.setSelection(Selection.near(selection.$head, direction));
        },
        filterTransaction(transaction, state) {
          if (mode === "schema" && transaction.selectionSet) {
            const { selection } = transaction;
            const selectsInheritedField = selection.empty
              ? isPositionInInheritedField(transaction.doc, selection.from)
              : rangeContainsInheritedField(transaction.doc, selection.from, selection.to);

            if (selectsInheritedField) return false;
          }

          if (!transaction.docChanged) return true;

          const schemaFields = fields();
          const currentRoot = inspectRoot(state.doc, mode, schemaFields);
          const nextRoot = inspectRoot(transaction.doc, mode, schemaFields);
          const schemaControlled =
            mode === "schema" ||
            schemaFields.length > 0 ||
            currentRoot.hasSchemaFields ||
            nextRoot.hasSchemaFields;

          if (!schemaControlled) return true;

          const changesEntryStructure =
            mode === "entry" &&
            currentRoot.hasSchemaFields &&
            !transaction.getMeta(ySyncPluginKey) &&
            (getFieldStructure(state.doc, schemaFields) !==
              getFieldStructure(transaction.doc, schemaFields) ||
              (hasOrderedFields(state.doc, schemaFields) &&
                !hasOrderedFields(transaction.doc, schemaFields)));

          if (changesEntryStructure) return false;

          const addsInvalidRootBlock = nextRoot.invalidBlocks > currentRoot.invalidBlocks;

          return !addsInvalidRootBlock && hasValidFragmentBlocks(transaction.doc);
        }
      })
    ];
  }
});

export { SchemaConstraints };
export type { SchemaConstraintsOptions };
