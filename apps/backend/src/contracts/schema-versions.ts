import { MAX_PAGE_SIZE } from "#backend/lib/api/limits";
import { schemaMigrationErrors } from "./errors";
import {
  schemaApplicationResultType,
  schemaVersionDetailsType,
  schemaVersionSummaryType
} from "#backend/lib/data/content-schema";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";
import { paginationType } from "./schemas/pagination";

const schemaVersionListType = z.object({
  data: z.array(schemaVersionSummaryType),
  pagination: paginationType
});
const schemaVersionsContract = baseContract.router({
  list: authenticatedContract
    .route({
      summary: "List schema versions",
      description:
        "Lists versions of a local collection schema. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.",
      tags: ["schemaVersions"],
      method: "GET",
      path: "/schemas/{schemaID}/versions"
    })
    .meta({ example: { schemaID: "sch_example", limit: 20 } })
    .meta({ required: { session: true, key: ["read:collections"] } })
    .input(
      z.object({
        schemaID: id().describe("ID of the local collection schema"),
        cursor: id().optional().describe("Cursor from the previous page"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_PAGE_SIZE)
          .optional()
          .describe("Maximum versions to return")
      })
    )
    .output(schemaVersionListType),
  get: authenticatedContract
    .route({
      summary: "Get a schema version",
      description: "Returns a saved schema version and its definition.",
      tags: ["schemaVersions"],
      method: "GET",
      path: "/schema-versions/{id}"
    })
    .meta({ example: { id: "schv_example" } })
    .meta({ required: { session: true, key: ["read:collections"] } })
    .input(z.object({ id: id().describe("ID of the schema version") }))
    .output(schemaVersionDetailsType),
  revert: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Restore a schema version",
      description:
        "Restores the selected definition and starts any required content migration. Review possible content removal before calling: confirmedDataLoss must be true. Use schemaMigrations.get to follow a returned migrationID.",
      tags: ["schemaVersions"],
      method: "POST",
      path: "/schema-versions/{id}/revert"
    })
    .meta({ example: { id: "schv_example", confirmedDataLoss: true } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z.object({
        id: id().describe("ID of the schema version to restore"),
        confirmedDataLoss: z
          .literal(true)
          .describe("Confirmation that the migration can remove entry content"),
        name: z.string().trim().min(1).max(100).optional().describe("Optional version name")
      })
    )
    .output(schemaApplicationResultType),
  update: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Rename a schema version",
      description: "Changes the saved version name. Set name to null to remove the name.",
      tags: ["schemaVersions"],
      method: "PATCH",
      path: "/schema-versions/{id}"
    })
    .meta({ example: { id: "schv_example", name: "Reviewed schema" } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z.object({
        id: id().describe("ID of the schema version"),
        name: z
          .union([z.string().trim().min(1).max(100), z.null()])
          .describe("New version name, or null to remove it")
      })
    )
    .output(z.void())
});

export { schemaVersionsContract };
