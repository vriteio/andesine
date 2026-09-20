import {
  entrySelectorShape,
  collectionSelectorShape,
  hasEntrySelector,
  hasOptionalCollectionSelector
} from "./schemas/paths";
import { contentNameErrors } from "./errors";
import { schemaHashType } from "#backend/lib/schema/contract/recorded";
import { contentReadErrors } from "./errors";
import { MAX_PAGE_SIZE, MAX_BULK_ITEMS } from "#backend/lib/api/limits";
import { schemaMigrationErrors } from "./errors";
import { entryType, lexoRank } from "#backend/db";
import { id } from "#backend/lib/primitives";
import { entryName } from "#backend/lib/validation/content-name";
import * as z from "zod";
import { authenticatedContract, baseContract, sessionContract } from "./base";
import { entryDetailsType, entryListType, entrySummaryType } from "./schemas/entries";

const entriesContract = baseContract.prefix("/entries").router({
  create: authenticatedContract
    .errors(contentNameErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Create an entry",
      description:
        "Creates an entry and its initial document. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. A collection schema can set the initial content.",
      tags: ["entries"],
      method: "POST",
      path: "/"
    })
    .meta({ example: { name: "Getting started", collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(entryType.omit({ order: true }).partial())
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
    .errors(schemaMigrationErrors)
    .route({
      summary: "Rename an entry",
      description:
        "Updates the entry name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.",
      tags: ["entries"],
      method: "PUT",
      path: "/{id}"
    })
    .meta({ example: { id: "ent_example", name: "Installation" } })
    .meta({ required: { session: true, key: ["entries"] } })
    .input(
      z.object({
        id: id().describe("ID of the entry to be updated"),
        name: entryName().optional().describe("New name of the entry")
      })
    )
    .output(z.void()),
  move: sessionContract
    .errors(contentNameErrors)
    .errors(schemaMigrationErrors)
    .input(
      z.object({
        id: id().describe("ID of the entry to be moved"),
        order: lexoRank().describe("New LexoRank order of the entry"),
        collectionID: id().optional().nullable().describe("ID of the new parent collection"),
        confirmedDataLoss: z
          .boolean()
          .default(false)
          .describe("Confirmation that a schema migration caused by the move can remove content")
      })
    )
    .output(
      z.object({
        order: z.string(),
        migrationID: id().nullable(),
        totalEntries: z.number().int().nonnegative()
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
          expectedSchemaHash: schemaHashType.optional()
        })
        .refine(hasEntrySelector, { message: "Use exactly one id or path" })
    )
    .output(entryDetailsType),
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
          message: "Use collectionID or collectionPath, not both"
        })
    )
    .output(entryListType)
});

export { entriesContract };
