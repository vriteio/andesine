import { pageInputType, paginationType } from "./schemas/pagination";
import {
  schemaMigrationContentLossEntryType,
  schemaMigrationDetailsType
} from "#backend/lib/data/content-schema";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { authenticatedContract, baseContract } from "./base";

const schemaMigrationsContract = baseContract.router({
  listContentLossEntries: authenticatedContract
    .route({
      method: "GET",
      path: "/schema-migrations/{id}/content-loss-entries",
      tags: ["schemaMigrations"],
      summary: "List entries with migration content loss",
      description:
        "Lists accessible, non-deleted entries that lost content in a completed migration. Returns an empty page until completion. Use pagination.nextCursor to continue."
    })
    .meta({
      required: { session: true, key: ["read:collections"] },
      example: { id: "smg_example", limit: 20 }
    })
    .input(pageInputType.extend({ id: id() }))
    .output(
      z.object({ data: z.array(schemaMigrationContentLossEntryType), pagination: paginationType })
    ),
  getActive: authenticatedContract
    .route({
      summary: "Get the active schema migration",
      description: "Returns the active migration for a collection, or null when none is active.",
      tags: ["schemaMigrations"],
      method: "GET",
      path: "/collections/{collectionID}/schema-migration"
    })
    .meta({ example: { collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["read:collections"] } })
    .input(z.object({ collectionID: id().describe("ID of the affected collection") }))
    .output(schemaMigrationDetailsType.nullable()),
  get: authenticatedContract
    .route({
      summary: "Get schema migration status",
      description:
        "Returns bounded migration progress and status. Use schemaMigrations.listContentLossEntries for per-entry content loss details. Check status before repeating an operation blocked by this migration.",
      tags: ["schemaMigrations"],
      method: "GET",
      path: "/schema-migrations/{id}"
    })
    .meta({ example: { id: "smg_example" } })
    .meta({ required: { session: true, key: ["read:collections"] } })
    .input(z.object({ id: id().describe("ID of the schema migration") }))
    .output(schemaMigrationDetailsType)
});

export { schemaMigrationsContract };
