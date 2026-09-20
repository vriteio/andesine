import { publicCollectionType } from "./schemas/collections";
import { collectionSelectorShape, hasOptionalCollectionSelector } from "./schemas/paths";
import { contentNameErrors } from "./errors";
import { MAX_PAGE_SIZE, MAX_BULK_ITEMS } from "#backend/lib/api/limits";
import { schemaMigrationErrors } from "./errors";
import { collectionType } from "#backend/db";
import { id } from "#backend/lib/primitives";
import { collectionName } from "#backend/lib/validation/content-name";
import * as z from "zod";
import { authenticatedContract, baseContract, sessionContract } from "./base";
import { paginationType } from "./schemas/pagination";

const collectionListType = z.object({
  data: z.array(publicCollectionType),
  pagination: paginationType
});
const restrictedGroupAssignmentType = z.object({
  groupID: id(),
  roleID: id()
});
const restrictedMemberAssignmentType = z.object({
  memberID: id(),
  roleID: id()
});
const restrictedAssignmentsType = z.object({
  groups: z.array(restrictedGroupAssignmentType),
  members: z.array(restrictedMemberAssignmentType)
});
const collectionsContract = baseContract.prefix("/collections").router({
  listRestrictedAssignments: sessionContract
    .route({ method: "GET", path: "/{id}/restricted-assignments" })
    .input(z.object({ id: collectionType.shape.id }))
    .output(restrictedAssignmentsType),
  setRestrictedAssignments: sessionContract
    .route({ method: "PUT", path: "/{id}/restricted-assignments" })
    .input(z.object({ id: collectionType.shape.id }).extend(restrictedAssignmentsType.shape))
    .output(z.void()),
  create: authenticatedContract
    .errors(contentNameErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Create a collection",
      description:
        "Creates a child collection. Without parentID, uses the workspace root. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed, NFC-normalized, case-sensitive, and shared by sibling entries and collections. Names cannot contain a slash or equal a single dot or two dots. Restricted collections require a session with restricted_collections permission and the Pro plan; API keys cannot create them.",
      tags: ["collections"],
      method: "POST",
      path: "/"
    })
    .meta({ example: { name: "Documentation", parentID: "coll_example" } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      collectionType
        .pick({ id: true, name: true })
        .extend({
          parentID: id().describe("ID of the parent collection,"),
          restricted: z.boolean().describe("Whether to restrict access to the collection tree")
        })
        .partial()
    )
    .output(publicCollectionType),
  bulkDelete: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Delete collection trees",
      description:
        "Soft-deletes the selected collections, their descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.",
      tags: ["collections"],
      method: "POST",
      path: "/bulk/delete"
    })
    .meta({ example: { ids: ["coll_example"] } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z.object({
        ids: z.array(id()).min(1).max(MAX_BULK_ITEMS).describe("IDs of the collections to delete")
      })
    )
    .output(z.void()),
  delete: authenticatedContract
    .errors(schemaMigrationErrors)
    .route({
      summary: "Delete a collection tree",
      description:
        "Soft-deletes the collection, its descendants, and their entries. The workspace root cannot be deleted. An active schema migration can block this action.",
      tags: ["collections"],
      method: "DELETE",
      path: "/{id}"
    })
    .meta({ example: { id: "coll_example" } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z.object({
        id: id().describe("ID of the collection to delete")
      })
    )
    .output(z.void()),
  update: authenticatedContract
    .errors(contentNameErrors)
    .errors(schemaMigrationErrors)
    .route({
      summary: "Rename a collection",
      description:
        "Updates the collection name. Rejects names already used by a sibling entry or collection. An active schema migration can block this action.",
      tags: ["collections"],
      method: "PUT",
      path: "/{id}"
    })
    .meta({ example: { id: "coll_example", name: "Guides" } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z.object({
        id: id().describe("ID of the collection to be updated"),
        name: collectionName().optional().describe("New name of the collection")
      })
    )
    .output(z.void()),
  setRestricted: sessionContract
    .route({ method: "PUT", path: "/{id}/restricted" })
    .input(
      z.object({
        id: id().describe("ID of the collection to configure"),
        restricted: z.boolean().describe("Whether to restrict access to the collection tree")
      })
    )
    .output(z.void()),
  move: sessionContract
    .errors(contentNameErrors)
    .errors(schemaMigrationErrors)
    .input(
      z.object({
        id: id().describe("ID of the collection to be moved"),
        newParentID: id()
          .nullable()
          .optional()
          .describe("ID of the new parent collection, or null for the top level"),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("New zero-based index in the parent collection's descendants array"),
        confirmedDataLoss: z
          .boolean()
          .default(false)
          .describe("Confirmation that a schema migration caused by the move can remove content")
      })
    )
    .output(
      z.object({
        migrationID: id().nullable(),
        totalEntries: z.number().int().nonnegative()
      })
    ),
  list: authenticatedContract
    .route({
      summary: "List collections",
      description:
        "Lists collections under the selected ancestor. Pass pagination.nextCursor to the next request while pagination.hasMore is true. The limit is 1 to 100.",
      tags: ["collections"],
      method: "GET",
      path: "/list"
    })
    .meta({ example: { collectionID: "coll_example", limit: 20 } })
    .meta({ required: { session: true, key: ["read:collections"] } })
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
            .describe("Maximum collections to return")
        })
        .refine(hasOptionalCollectionSelector, {
          message: "Use collectionID or collectionPath, not both"
        })
    )
    .output(collectionListType)
});

export { collectionsContract };
