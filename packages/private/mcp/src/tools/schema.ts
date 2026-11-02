import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entryPropertyKindType } from "@andesine/contracts/entries";
import { fromMDX } from "@andesine/converters/mdx";
import {
  getEmptyPropertyValue,
  getSchemaFieldKey,
  getSchemaFieldName,
  SCHEMA_BLOCK_TYPES,
  schemaBlockType,
  schemaDefinitionType,
  schemaPropertyValueType,
  type SchemaField
} from "@andesine/contracts/schema";
import * as z from "zod";
import { getMigrationSummary, resolveCollectionID, runTool, type ToolContext } from "../context";

const fieldInputShape = {
  id: z.string().optional().describe("ID from get_schema"),
  name: z.string(),
  optional: z.boolean().optional().describe("Entries can leave out the field (default: required)")
};
const propertyInputSchema = z.object({
  ...fieldInputShape,
  kind: z.literal("property"),
  type: entryPropertyKindType,
  options: z.array(z.string()).optional().describe("Choices of select and multi-select"),
  initialValue: schemaPropertyValueType.optional()
});
const fragmentInputSchema = z.object({
  ...fieldInputShape,
  kind: z.literal("fragment"),
  allowedBlocks: z
    .array(schemaBlockType)
    .optional()
    .describe("Allowed blocks besides paragraphs (default: all)"),
  initialContent: z
    .string()
    .optional()
    .describe("MDX that the fragment starts with in new entries; no images. Empty clears it.")
});
const fieldInputSchema = z.discriminatedUnion("kind", [propertyInputSchema, fragmentInputSchema]);

type FieldInput = z.infer<typeof fieldInputSchema>;

const decodeInitialContent = async (mdx: string) => {
  const document = await fromMDX(mdx, {
    document: "fragment",
    imageAssetID: () => {
      throw new Error("Upload images in entries, not initial content");
    }
  });

  return document.content;
};
const toSchemaField = async (
  field: FieldInput,
  draftFields: SchemaField[],
  claimedIDs: Set<string>
): Promise<SchemaField> => {
  const key = getSchemaFieldKey({ kind: field.kind, label: field.name });
  // A field without an ID is the unclaimed one with its key, so its content in entries stays.
  const current = draftFields.find((draftField) => {
    if (field.id) return draftField.id === field.id;

    return !claimedIDs.has(draftField.id) && getSchemaFieldKey(draftField) === key;
  });
  const id = field.id ?? current?.id ?? crypto.randomUUID();
  // An empty label shows as the default name, and sending it back shouldn't rename the field.
  const label =
    current?.kind === field.kind && getSchemaFieldName(current) === field.name
      ? current.label
      : field.name;
  const optional = field.optional ?? current?.optional;

  if (field.kind === "property") {
    // An initial value and options only fit the type they were set for.
    const kept = current?.kind === "property" && current.type === field.type ? current : undefined;

    return {
      id,
      kind: "property",
      label,
      type: field.type,
      options: field.options ?? kept?.options ?? [],
      initialValue: field.initialValue ?? kept?.initialValue ?? getEmptyPropertyValue(field),
      ...(optional && { optional })
    };
  }

  const kept = current?.kind === "fragment" ? current : undefined;
  const initialContent =
    field.initialContent === undefined
      ? kept?.initialContent
      : await decodeInitialContent(field.initialContent);

  return {
    id,
    kind: "fragment",
    label,
    allowedBlocks: field.allowedBlocks ?? kept?.allowedBlocks ?? [...SCHEMA_BLOCK_TYPES],
    initialContent: initialContent?.length
      ? initialContent
      : [{ type: "paragraph", attrs: { id: crypto.randomUUID() } }],
    ...(optional && { optional })
  };
};
const registerSetSchema = (server: McpServer, context: ToolContext) => {
  server.registerTool(
    "set_schema",
    {
      title: "Set a collection schema",
      description:
        "Replaces a collection's own schema fields and applies them to its entries, creating the schema if needed. fields null removes the local schema. Keep field IDs from get_schema to rename a field; a field without an ID matches the current one with the same name, ignoring case and punctuation, or else is new. Inherited fields can't change here, and are ignored when sent. A migration can start; follow it with get_migration.",
      inputSchema: {
        collection: z.string().describe("Collection ID (coll_...) or path"),
        fields: z.array(fieldInputSchema).nullable(),
        confirmedDataLoss: z
          .literal(true)
          .describe(
            "Accepts that the change can remove content from entries. Set it only after reviewing the entries and the fields."
          ),
        discardDraft: z
          .boolean()
          .optional()
          .describe("Overwrite unapplied draft changes that people made in the schema editor"),
        versionName: z.string().optional().describe("Name of the schema version")
      },
      annotations: {
        title: "Set a collection schema",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    runTool(async ({ collection, fields, discardDraft, versionName }) => {
      const collectionID = await resolveCollectionID(context, collection);
      const { local, effective } = await context.client.schemas.get({ collectionID });
      const enabledLocal = local?.enabled ? local : null;
      const draftFields = enabledLocal?.draft?.fields ?? [];
      const hasOtherChanges = enabledLocal?.hasUnappliedChanges && draftFields.length > 0;

      if (hasOtherChanges && !discardDraft) {
        throw new Error(
          "The schema draft has unapplied changes. Review them with get_schema (detail full), then set discardDraft to overwrite them."
        );
      }

      if (fields === null) {
        if (!enabledLocal) return { removed: false };

        const removed = await context.client.schemas.delete({
          schemaID: enabledLocal.id,
          confirmedDataLoss: true
        });

        return {
          removed: true,
          ...getMigrationSummary(removed)
        };
      }

      const inheritedIDs = new Set(
        (effective?.definition.fields ?? []).flatMap(({ id, source }) => {
          return source.inherited ? [id] : [];
        })
      );
      const ownFields = fields.filter(({ id }) => !id || !inheritedIDs.has(id));
      const claimedIDs = new Set(ownFields.flatMap(({ id }) => id ?? []));
      const parsed = schemaDefinitionType.safeParse({
        formatVersion: 1,
        fields: await Promise.all(
          ownFields.map((field) => toSchemaField(field, draftFields, claimedIDs))
        )
      });

      if (!parsed.success) throw new Error(parsed.error.issues[0].message);

      const definition = parsed.data;
      const schema = enabledLocal ?? (await context.client.schemas.create({ collectionID }));

      const applied = await context.client.schemas.apply({
        schemaID: schema.id,
        confirmedDataLoss: true,
        name: versionName,
        definition,
        expectedHash: schema.draftHash ?? undefined
      });

      return {
        changed: applied.changed,
        schemaVersionID: applied.schemaVersionID,
        fieldIDs: definition.fields.map(({ id }) => id),
        ...getMigrationSummary(applied)
      };
    })
  );
};

const schemaTools = { set_schema: registerSetSchema };

export { schemaTools };
