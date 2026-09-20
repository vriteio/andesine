import { collectionSelectorShape, hasCollectionSelector } from "./schemas/paths";
import { schemaRevisionType } from "#backend/lib/schema/contract/recorded";
import { schemaMigrationErrors } from "./errors";
import {
  collectionSchemaDetailsType,
  localCollectionSchemaType,
  schemaApplicationResultType
} from "#backend/lib/data/content-schema";
import { id, publicID } from "#backend/lib/primitives";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";

const schemasContract = baseContract.router({
  create: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Create a local collection schema",
      description:
        "Creates a local schema draft for the collection. Use schemas.get to inspect local and effective schemas.",
      tags: ["schemas"],
      method: "POST",
      path: "/collections/{collectionID}/schema"
    })
    .meta({ example: { collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(z.object({ collectionID: id().describe("ID of the collection") }))
    .output(localCollectionSchemaType),
  delete: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Delete a local schema",
      description:
        "Removes the local schema and recalculates inherited schemas. This can start a content migration. Review possible content removal before setting confirmedDataLoss. Use schemaMigrations.get with a returned migrationID.",
      tags: ["schemas"],
      method: "DELETE",
      path: "/schemas/{schemaID}"
    })
    .meta({ example: { schemaID: "sch_example", confirmedDataLoss: false } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z.object({
        schemaID: id().describe("ID of the local collection schema"),
        confirmedDataLoss: z
          .boolean()
          .default(false)
          .describe("Confirmation that an inherited-schema migration can remove entry content")
      })
    )
    .output(
      z.object({
        migrationID: id().nullable(),
        affectedCollectionIDs: z.array(id()),
        totalEntries: z.number().int().nonnegative()
      })
    ),
  getRevision: authenticatedContract
    .route({
      method: "GET",
      path: "/schema-revisions/{revisionID}",
      summary: "Get an exact schema revision",
      description:
        "Returns the recorded effective definition, including inherited fields. Requires read access to the revision's collection. The definition is independent of the currently active schema.",
      tags: ["schemas"]
    })
    .meta({
      required: { session: true, key: ["read:collections"] },
      example: { revisionID: "schr_example" }
    })
    .input(z.object({ revisionID: publicID("schr") }))
    .output(schemaRevisionType),
  get: authenticatedContract
    .route({
      summary: "Get collection schemas",
      description:
        "Returns local and effective schema details for the collection, including inheritance.",
      tags: ["schemas"],
      method: "GET",
      path: "/schemas/collection"
    })
    .meta({ example: { collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["read:collections"] } })
    .input(
      z.object(collectionSelectorShape).refine(hasCollectionSelector, {
        message: "Use exactly one collectionID or collectionPath"
      })
    )
    .output(collectionSchemaDetailsType),
  apply: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Apply a schema draft",
      description:
        "Creates a schema version from the draft and starts any required migration of affected entry content. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.",
      tags: ["schemas"],
      method: "POST",
      path: "/schemas/{schemaID}/apply"
    })
    .meta({
      example: { schemaID: "sch_example", confirmedDataLoss: true, name: "Reviewed schema" }
    })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z.object({
        schemaID: id().describe("ID of the local collection schema"),
        confirmedDataLoss: z
          .literal(true)
          .describe("Confirmation that the migration can remove entry content"),
        name: z.string().trim().min(1).max(100).optional().describe("Optional version name")
      })
    )
    .output(schemaApplicationResultType)
});

export { schemasContract };
