import {
  entrySelectorShape,
  collectionSelectorShape,
  hasEntrySelector,
  hasOptionalCollectionSelector
} from "./schemas/paths";
import {
  contentFormatErrors,
  contentNameErrors,
  contentPreconditionErrors,
  idempotencyErrors,
  contentPublicationErrors,
  contentReadErrors,
  contentWriteErrors,
  schemaMigrationErrors
} from "./errors";
import { schemaHashType } from "../schema/recorded";
import { MAX_PAGE_SIZE, MAX_BULK_ITEMS } from "../limits";
import { entryType, lexoRank } from "../entities/entries";
import { id } from "../primitives/id";
import { entryName } from "../content/name";
import { versionSummaryType } from "../versions/index";
import { contentNodeType } from "@andesine/document";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";
import {
  entryDetailsType,
  entryListType,
  entryReferencesType,
  entrySummaryType
} from "./schemas/entries";
import {
  contentBlockType,
  contentOperationType,
  entryContentFormatType,
  fieldValueType,
  mdxContentType
} from "./schemas/formats";

const contentHashType = z.string().length(64);
const entryDocumentType = contentNodeType.describe(
  "ProseMirror JSON of the entry document, which must match the editor and the collection schema"
);
const countDefined = (...values: unknown[]): number => {
  return values.filter((value) => value !== undefined).length;
};
const entryUpdateType = z
  .object({
    id: id().describe("ID of the entry to be updated"),
    name: entryName().optional().describe("New name of the entry"),
    document: entryDocumentType.optional(),
    mdx: mdxContentType.optional(),
    operations: z
      .array(contentOperationType)
      .min(1)
      .max(MAX_BULK_ITEMS)
      .optional()
      .describe("Edit operations, applied in order; all or none apply"),
    expectedHash: contentHashType
      .optional()
      .describe("Hash of the content that the change is based on"),
    expectedName: entryName().optional().describe("Name the entry must still have"),
    version: z
      .object({
        name: z.string().trim().min(1).max(100).optional().describe("Version name")
      })
      .optional()
      .describe("Also save the new content as a version")
  })
  .refine((input) => countDefined(input.document, input.mdx, input.operations) <= 1, {
    message: "Use one of document, mdx, or operations",
    path: ["document"]
  })
  .refine((input) => countDefined(input.name, input.document, input.mdx) <= 1, {
    message: "Use name with operations, or alone; the document title sets the name",
    path: ["name"]
  })
  .refine((input) => countDefined(input.name, input.document, input.mdx, input.operations) > 0, {
    message: "Use name, document, mdx, or operations",
    path: ["name"]
  })
  .refine((input) => (!input.document && input.mdx === undefined) || input.expectedHash, {
    message: "Use expectedHash with document or mdx",
    path: ["expectedHash"]
  })
  .refine(
    (input) => !input.version || countDefined(input.document, input.mdx, input.operations) > 0,
    {
      message: "Use version with document, mdx, or operations",
      path: ["version"]
    }
  );
const entryUpdateResultType = z.object({
  hash: contentHashType.describe("Hash of the current content after the update"),
  version: versionSummaryType.optional().describe("The version saved with version")
});
const hasOneMoveTarget = (input: {
  collectionID?: string | null;
  collectionPath?: string;
  collectionSlugPath?: string;
}): boolean => {
  return countDefined(input.collectionID, input.collectionPath, input.collectionSlugPath) <= 1;
};
const entryMoveShape = {
  id: id().describe("ID of the entry to be moved"),
  order: lexoRank().optional().describe("New LexoRank order of the entry"),
  collectionID: id().optional().nullable().describe("ID of the new parent collection"),
  collectionPath: collectionSelectorShape.collectionPath.describe(
    "Name path of the new parent collection; / is the top level"
  ),
  collectionSlugPath: collectionSelectorShape.collectionSlugPath.describe(
    "Slug path of the new parent collection; / is the top level"
  ),
  expectedCollectionID: id()
    .nullable()
    .optional()
    .describe("ID of the collection that must still contain the entry, or null for the top level")
};
const moveTargetMessage = {
  message: "Use only one of collectionID, collectionPath, or collectionSlugPath",
  path: ["collectionID"]
};
const entriesContract = baseContract.prefix("/entries").router({
  create: authenticatedContract
    .errors(contentNameErrors)
    .errors(contentPublicationErrors)
    .errors(contentFormatErrors)
    .errors(idempotencyErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Create an entry",
      description:
        "Creates an entry and its initial document, in the collection given by collectionID, collectionPath, or collectionSlugPath (the top level by default). The name defaults to Untitled, or comes from the title of the supplied document or mdx. fields sets property values and fragment MDX by field name or key. path places the entry at a full name path and creates missing parent collections; a name already used there is a conflict. A repeated request with the same Idempotency-Key header returns the first result for 24 hours. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed and NFC-normalized. Derived URL slugs must be unique across sibling entries and collections, including case and punctuation variants. Names cannot contain a slash or equal a single dot or two dots. A collection schema sets the initial content without a document; a document must match it.",
      tags: ["entries"],
      method: "POST",
      path: "/"
    })
    .meta({ example: { name: "Getting started", collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["entries"] }, idempotent: true })
    .input(
      entryType
        .omit({ order: true })
        .partial()
        .extend({
          document: entryDocumentType.optional(),
          mdx: mdxContentType.optional(),
          fields: z
            .record(z.string(), fieldValueType)
            .optional()
            .describe("Field values by name or key, set on the initial content"),
          path: z
            .string()
            .optional()
            .describe("Full name path of the entry, for example /Guides/Setup"),
          collectionPath: collectionSelectorShape.collectionPath.describe(
            "Name path of an existing parent collection"
          ),
          collectionSlugPath: collectionSelectorShape.collectionSlugPath.describe(
            "Slug path of an existing parent collection"
          )
        })
        .refine(hasOptionalCollectionSelector, {
          message: "Use only one of collectionID, collectionPath, or collectionSlugPath",
          path: ["collectionID"]
        })
        .refine(
          (input) => {
            const collection =
              input.collectionID ?? input.collectionPath ?? input.collectionSlugPath;

            return !input.path || (!input.name && collection === undefined);
          },
          { message: "Use path, or name and a parent collection", path: ["path"] }
        )
        .refine((input) => countDefined(input.name, input.document, input.mdx) <= 1, {
          message: "Use one of name, document, or mdx; the title sets the name",
          path: ["name"]
        })
    )
    .output(entrySummaryType),
  bulkDelete: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Delete entries",
      description:
        "Soft-deletes the selected entries and clears current-entry selections for affected members. An active schema migration can block this action.",
      tags: ["entries"],
      method: "POST",
      path: "/bulk/delete"
    })
    .meta({ example: { ids: ["ent_example"] } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      z.object({
        ids: z.array(id()).min(1).max(MAX_BULK_ITEMS).describe("IDs of the entries to delete")
      })
    )
    .output(z.void()),
  delete: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Delete an entry",
      description:
        "Soft-deletes the entry and clears current-entry selections for affected members. An active schema migration can block this action.",
      tags: ["entries"],
      method: "DELETE",
      path: "/{id}"
    })
    .meta({ example: { id: "ent_example" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      z.object({
        id: id().describe("ID of the entry to delete")
      })
    )
    .output(z.void()),
  update: authenticatedContract
    .errors(contentNameErrors)
    .errors(contentWriteErrors)
    .errors(contentFormatErrors)
    .errors(contentPreconditionErrors)
    .errors(idempotencyErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Update an entry",
      description:
        "Renames the entry, replaces its content with document or mdx, or edits it with operations (with name, also renames). document and mdx need expectedHash, the hash of the content they replace (from entries.get); a different current hash returns CONTENT_HASH_MISMATCH. Operations anchor on block IDs, unique text, and field keys from entries.get with contentFormat blocks; expectedHash is optional for them, and a missing or ambiguous anchor returns CONTENT_OPERATION_INVALID. Only the changed blocks change, so live edits elsewhere are kept. Current content without a version is first saved as an auto version. version also saves the new content as a named version. Rejects names already used by a sibling entry or collection. expectedName applies the update only when the entry still has that name. An active schema migration can block this action. A repeated request with the same Idempotency-Key header returns the first result for 24 hours.",
      tags: ["entries"],
      method: "PUT",
      path: "/{id}"
    })
    .meta({ example: { id: "ent_example", name: "Installation" } })
    .meta({ required: { session: true, key: ["entries"] }, idempotent: true })
    .input(entryUpdateType)
    .output(entryUpdateResultType),
  bulkUpdate: authenticatedContract
    .errors(contentNameErrors)
    .errors(contentWriteErrors)
    .errors(contentFormatErrors)
    .errors(contentPreconditionErrors)
    .errors(idempotencyErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Update entries",
      description:
        "Writes content of many entries in one workspace lock, with the items of entries.update; a name without content is written as the title. All items are checked before any content changes, and all or none apply. Error messages name the failing item by index. Each entry can appear once. A repeated request with the same Idempotency-Key header returns the first result for 24 hours.",
      tags: ["entries"],
      method: "POST",
      path: "/bulk/update"
    })
    .meta({
      example: {
        items: [
          { id: "ent_example", operations: [{ type: "replaceText", find: "v1", replace: "v2" }] }
        ]
      }
    })
    .meta({ required: { session: true, key: ["entries"] }, idempotent: true })
    .input(
      z.object({
        items: z.array(entryUpdateType).min(1).max(MAX_BULK_ITEMS).describe("Entry updates")
      })
    )
    .output(
      z.object({
        items: z.array(entryUpdateResultType.extend({ id: id() })).describe("Results in order")
      })
    ),
  move: authenticatedContract
    .errors(contentNameErrors)
    .errors(schemaMigrationErrors)
    .errors(contentPreconditionErrors)
    .route({
      summary: "Move an entry",
      description:
        "Moves the entry to another collection or position. Without order, it keeps its position in the same collection and goes last in a new one. Rejects names already used in the new collection. A move that changes the schema can start a schema migration, which needs confirmedDataLoss when it can remove content.",
      tags: ["entries"],
      method: "POST",
      path: "/{id}/move"
    })
    .meta({ example: { id: "ent_example", collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      z
        .object({
          ...entryMoveShape,
          confirmedDataLoss: z
            .boolean()
            .default(false)
            .describe("Confirmation that a schema migration caused by the move can remove content")
        })
        .refine(hasOneMoveTarget, moveTargetMessage)
    )
    .output(
      z.object({
        order: z.string(),
        migrationID: id().nullable(),
        totalEntries: z.number().int().nonnegative()
      })
    ),
  bulkMove: authenticatedContract
    .errors(contentNameErrors)
    .errors(contentPreconditionErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Move entries",
      description:
        "Moves many entries in one workspace lock, with the items of entries.move; all or none apply. Moves that need a schema migration aren't supported; move those entries with entries.move. Error messages name the failing item by index. Each entry can appear once.",
      tags: ["entries"],
      method: "POST",
      path: "/bulk/move"
    })
    .meta({ example: { items: [{ id: "ent_example", collectionPath: "/Guides" }] } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      z.object({
        items: z
          .array(z.object(entryMoveShape).refine(hasOneMoveTarget, moveTargetMessage))
          .min(1)
          .max(MAX_BULK_ITEMS)
          .describe("Entry moves")
      })
    )
    .output(
      z.object({
        items: z
          .array(
            z.object({
              id: id(),
              order: z.string(),
              collectionID: id().nullable().describe("Parent collection after the move")
            })
          )
          .describe("Results in order")
      })
    ),
  get: authenticatedContract
    .errors(contentReadErrors)
    .route({
      summary: "Get an entry",
      description:
        "Returns current entry details, fragments, properties, and recorded schema metadata. Validates content without changing it. expectedSchemaHash must match the recorded schema; schema-less content cannot match it. Use content.get to read published content.",
      tags: ["entries"],
      method: "GET",
      path: "/get"
    })
    .meta({ example: { id: "ent_example" } })
    .meta({ required: { session: true, key: ["read:entries"] } })
    .input(
      z
        .object({
          ...entrySelectorShape,
          expectedSchemaHash: schemaHashType.optional(),
          contentFormat: entryContentFormatType
        })
        .refine(hasEntrySelector, { message: "Use exactly one id, path, or slugPath" })
    )
    .output(
      entryDetailsType.extend({
        mdx: mdxContentType.optional(),
        blocks: z.array(contentBlockType).optional(),
        references: entryReferencesType
      })
    ),
  list: authenticatedContract
    .route({
      summary: "List entries",
      description:
        "Lists entries in the selected collection, or all accessible entries when collectionID is omitted. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100 and defaults to 50.",
      tags: ["entries"],
      method: "GET",
      path: "/list"
    })
    .meta({ example: { collectionID: "coll_example", limit: 20 } })
    .meta({ required: { session: true, key: ["read:entries"] } })
    .input(
      z
        .object({
          ...collectionSelectorShape,
          cursor: id().optional().describe("Cursor from the previous page"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(MAX_PAGE_SIZE)
            .optional()
            .describe("Maximum entries to return")
        })
        .refine(hasOptionalCollectionSelector, {
          message: "Use only one collectionID, collectionPath, or collectionSlugPath"
        })
    )
    .output(entryListType)
});

export { entriesContract };
