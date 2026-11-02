import { findDisallowedElementBlock, type ContentNode } from "@andesine/document";
import { hashContentDocument } from "../../content/index";
import {
  SCHEMA_BLOCK_TYPES,
  SCHEMA_FIELD_ID_ATTRIBUTE,
  schemaDefinitionType,
  type SchemaDefinition,
  type SchemaField,
  type SchemaFragment,
  type SchemaProperty
} from "@andesine/contracts/schema";
import {
  cloneContentNodes,
  createEmptyContentNodes,
  getExistingSchemaFields,
  getPropertyType,
  hasMeaningfulContent,
  matchSchemaFields,
  type ExistingSchemaField
} from "./fields";
import { getEmptyPropertyValue, isPropertyValueEmpty, migratePropertyValue } from "./property";

interface SchemaContentMigrationInput {
  initialMode?: SchemaContentInitialMode;
  document: ContentNode;
  schema: SchemaDefinition;
}
interface SchemaContentMigrationResult {
  changed: boolean;
  contentLost: boolean;
  document: ContentNode;
}

type SchemaContentInitialMode = "migration" | "new-entry" | "none";

const createPropertyNode = (
  property: SchemaProperty,
  initialMode: SchemaContentInitialMode,
  existing?: ExistingSchemaField
): { contentLost: boolean; node: ContentNode } => {
  const sourceType = getPropertyType(existing?.node.attrs?.type);
  const sourceValue = existing?.node.attrs?.value;
  const migration = existing
    ? migratePropertyValue(property, sourceType, sourceValue, {
        useInitial: initialMode === "migration"
      })
    : {
        contentLost: false,
        value: initialMode === "none" ? getEmptyPropertyValue(property) : property.initialValue
      };

  return {
    contentLost: migration.contentLost,
    node: {
      type: "property",
      attrs: {
        // Keep attributes that are not owned by schema enforcement.
        ...existing?.node.attrs,
        id: existing?.node.attrs?.id || crypto.randomUUID(),
        [SCHEMA_FIELD_ID_ATTRIBUTE]: property.id,
        label: property.label,
        options: [...property.options],
        type: property.type,
        value: Array.isArray(migration.value) ? [...migration.value] : migration.value
      }
    }
  };
};
const createFragmentNode = (
  fragment: SchemaFragment,
  content: ContentNode[],
  initialMode: SchemaContentInitialMode,
  existing?: ExistingSchemaField
): ContentNode => {
  const fragmentContent = hasMeaningfulContent(content)
    ? content
    : initialMode === "none"
      ? content.length > 0
        ? content
        : createEmptyContentNodes(fragment.initialContent)
      : cloneContentNodes(fragment.initialContent);

  return {
    type: "fragment",
    attrs: {
      // Keep attributes that are not owned by schema enforcement.
      ...existing?.node.attrs,
      id: existing?.node.attrs?.id || crypto.randomUUID(),
      [SCHEMA_FIELD_ID_ATTRIBUTE]: fragment.id,
      allowedBlocks: [...fragment.allowedBlocks],
      name: fragment.label
    },
    content: fragmentContent
  };
};
const getFirstCompatibleFragment = (
  fragments: SchemaFragment[],
  node: ContentNode
): SchemaFragment | undefined => {
  return fragments.find((fragment) => {
    return !findDisallowedElementBlock([node], fragment.allowedBlocks);
  });
};
const migrateContentToSchema = (
  input: SchemaContentMigrationInput
): SchemaContentMigrationResult => {
  const initialMode = input.initialMode || "migration";
  const schema = schemaDefinitionType.parse(input.schema);
  const existingFields = getExistingSchemaFields(input.document);
  const matches = matchSchemaFields(schema.fields, existingFields);
  const properties = schema.fields.filter(
    (field): field is SchemaProperty => field.kind === "property"
  );
  const fragments = schema.fields.filter(
    (field): field is SchemaFragment => field.kind === "fragment"
  );
  const propertyNodes = new Map<string, ContentNode>();
  const fragmentContent = new Map<string, ContentNode[]>(
    fragments.map((fragment) => [fragment.id, []])
  );
  const isAbsentOptionalField = (field: SchemaField) => {
    return Boolean(field.optional) && !matches.has(field.id);
  };
  // Blocks without a field go to an absent optional fragment only as the last option.
  const targetFragments = [...fragments].sort((first, second) => {
    return Number(isAbsentOptionalField(first)) - Number(isAbsentOptionalField(second));
  });
  const matchedExistingIndexes = new Set(
    [...matches.values()].map((existingField) => existingField.index)
  );
  const titleIndex = (input.document.content || []).findIndex((node) => node.type === "title");
  const title =
    titleIndex >= 0
      ? input.document.content![titleIndex]
      : ({ type: "title" } satisfies ContentNode);

  let contentLost = false;

  for (const property of properties) {
    if (isAbsentOptionalField(property)) continue;

    const existing = matches.get(property.id);
    const migrated = createPropertyNode(property, initialMode, existing);

    contentLost ||= migrated.contentLost;
    propertyNodes.set(property.id, migrated.node);
  }

  for (const existing of existingFields) {
    if (existing.kind !== "property" || matchedExistingIndexes.has(existing.index)) continue;

    const type = getPropertyType(existing.node.attrs?.type);
    const value = existing.node.attrs?.value;
    const uncheckedCheckbox = type === "checkbox" && value === false;

    contentLost ||= !uncheckedCheckbox && !isPropertyValueEmpty(type, value);
  }

  (input.document.content || []).forEach((node, index) => {
    if (index === titleIndex || node.type === "property") return;
    if (node.type !== "fragment" && !hasMeaningfulContent([node])) return;

    const existing = existingFields.find((field) => field.index === index);
    const matchedFragment = existing
      ? fragments.find((fragment) => matches.get(fragment.id)?.index === existing.index)
      : undefined;
    const blocks = node.type === "fragment" ? node.content || [] : [node];

    for (const block of blocks) {
      const targetFragment =
        matchedFragment && !findDisallowedElementBlock([block], matchedFragment.allowedBlocks)
          ? matchedFragment
          : getFirstCompatibleFragment(targetFragments, block);

      if (!targetFragment) {
        contentLost ||= hasMeaningfulContent([block]);
        continue;
      }

      fragmentContent.get(targetFragment.id)!.push(block);
    }
  });

  const migratedFields = schema.fields.flatMap((field) => {
    if (field.kind === "property") return propertyNodes.get(field.id) ?? [];

    const content = fragmentContent.get(field.id) || [];

    if (isAbsentOptionalField(field) && !content.length) return [];

    return createFragmentNode(field, content, initialMode, matches.get(field.id));
  });
  const document: ContentNode = {
    ...input.document,
    type: "doc",
    // The document schema needs a block after the title, when all fields are absent.
    content: [title, ...(migratedFields.length ? migratedFields : [{ type: "paragraph" }])]
  };

  return {
    changed: hashContentDocument(document) !== hashContentDocument(input.document),
    contentLost,
    document
  };
};

/** Adds an absent optional field before the fields that follow it in the schema. */
const addOptionalField = (
  document: ContentNode,
  schema: SchemaDefinition,
  field: SchemaField
): ContentNode => {
  const content = (document.content ??= []);
  const order = schema.fields.map(({ id }) => id);
  const fieldOrder = order.indexOf(field.id);
  const nextIndex = content.findIndex((node) => {
    return (
      node.type === "paragraph" ||
      order.indexOf(String(node.attrs?.[SCHEMA_FIELD_ID_ATTRIBUTE])) > fieldOrder
    );
  });
  const node =
    field.kind === "property"
      ? createPropertyNode(field, "new-entry").node
      : createFragmentNode(field, [], "new-entry");

  content.splice(nextIndex < 0 ? content.length : nextIndex, 0, node);

  return node;
};
const removeContentSchema = (document: ContentNode): SchemaContentMigrationResult => {
  const content = document.content?.map((node) => {
    if (node.type !== "property" && node.type !== "fragment") return node;
    if (!node.attrs?.schemaFieldID && !node.attrs?.inherited && !node.attrs?.sourceCollectionID) {
      return node;
    }

    return {
      ...node,
      attrs: {
        ...node.attrs,
        schemaFieldID: null,
        inherited: false,
        sourceCollectionID: null,
        ...(node.type === "fragment" && { allowedBlocks: [...SCHEMA_BLOCK_TYPES] })
      }
    };
  });
  const unrestrictedDocument = { ...document, content };

  return {
    changed: hashContentDocument(unrestrictedDocument) !== hashContentDocument(document),
    contentLost: false,
    document: unrestrictedDocument
  };
};

export { addOptionalField, migrateContentToSchema, removeContentSchema };
export type { SchemaContentInitialMode, SchemaContentMigrationInput, SchemaContentMigrationResult };
