import { contentNameErrors } from "./errors";
import { schemaHashType } from "#backend/lib/schema/contract/recorded";
import { contentDeliveryErrors, contentReadErrors } from "./errors";
import { MAX_PAGE_SIZE } from "#backend/lib/api/limits";
import { schemaMigrationErrors } from "./errors";
import { versionDetailsType, versionSummaryType } from "#backend/lib/data/entry-version";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";
import { paginationType } from "./schemas/pagination";

const versionListType = z.object({
  data: z.array(versionSummaryType),
  pagination: paginationType
});
const versionsContract = baseContract.router({
  create: authenticatedContract
    .errors(contentDeliveryErrors)
    .route({
      summary: "Create an entry version",
      description: "Saves a version of the current entry content. Optionally assigns a name.",
      tags: ["versions"],
      method: "POST",
      path: "/entries/{entryID}/versions"
    })
    .meta({ example: { entryID: "ent_example", name: "Before release" } })
    .meta({ required: { session: true, key: ["versions"] } })
    .input(
      z.object({
        entryID: id().describe("ID of the entry to version"),
        name: z.string().trim().min(1).max(100).optional().describe("Optional version name")
      })
    )
    .output(versionDetailsType),
  list: authenticatedContract
    .route({
      summary: "List entry versions",
      description:
        "Lists saved entry versions. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.",
      tags: ["versions"],
      method: "GET",
      path: "/entries/{entryID}/versions"
    })
    .meta({ example: { entryID: "ent_example", limit: 20 } })
    .meta({ required: { session: true, key: ["read:versions"] } })
    .input(
      z.object({
        entryID: id().describe("ID of the entry whose versions to list"),
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
    .output(versionListType),
  get: authenticatedContract
    .errors(contentReadErrors)
    .route({
      summary: "Get an entry version",
      description:
        "Returns the saved content and recorded schema metadata of an entry version. Validates against its recorded revision, including historical versions. expectedSchemaHash must match that revision; schema-less content cannot match it.",
      tags: ["versions"],
      method: "GET",
      path: "/versions/{id}"
    })
    .meta({ example: { id: "ver_example" } })
    .meta({ required: { session: true, key: ["read:versions"] } })
    .input(
      z.object({
        id: id().describe("ID of the version to get"),
        expectedSchemaHash: schemaHashType.optional()
      })
    )
    .output(versionDetailsType),
  update: authenticatedContract
    .route({
      summary: "Rename an entry version",
      description: "Changes the saved version name. Set name to null to remove the name.",
      tags: ["versions"],
      method: "PATCH",
      path: "/versions/{id}"
    })
    .meta({ example: { id: "ver_example", name: "Release candidate" } })
    .meta({ required: { session: true, key: ["versions"] } })
    .input(
      z.object({
        id: id().describe("ID of the version to update"),
        name: z
          .union([z.string().trim().min(1).max(100), z.null()])
          .describe("New version name, or null to remove it")
      })
    )
    .output(z.void()),
  revert: authenticatedContract
    .errors(contentNameErrors)
    .errors(contentDeliveryErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Restore an entry version",
      description:
        "Restores saved content to the current entry and returns the resulting version. An active schema migration can block this action.",
      tags: ["versions"],
      method: "POST",
      path: "/versions/{id}/revert"
    })
    .meta({ example: { id: "ver_example" } })
    .meta({ required: { session: true, key: ["versions"] } })
    .input(z.object({ id: id().describe("ID of the version to restore") }))
    .output(versionDetailsType)
});

export { versionsContract };
