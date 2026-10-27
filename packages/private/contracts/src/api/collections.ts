import { publicCollectionType } from "./schemas/collections";
import {
  collectionSelectorShape,
  contentPathType,
  contentSlugPathType,
  hasCollectionSelector,
  hasOptionalCollectionSelector
} from "./schemas/paths";
import { contentNameErrors, contentPreconditionErrors, schemaMigrationErrors } from "./errors";
import { MAX_PAGE_SIZE, MAX_BULK_ITEMS } from "../limits";
import { collectionType } from "../entities/collections";
import { id } from "../primitives/id";
import { collectionName } from "../content/name";
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
const hasOptionalParentSelector = (input: {
  parentID?: string;
  parentPath?: string;
  parentSlugPath?: string;
}): boolean => {
  return (
    [input.parentID, input.parentPath, input.parentSlugPath].filter((value) => value !== undefined)
      .length <= 1
  );
};
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
        "Creates a child collection. Without parentID, uses the workspace root. The name defaults to Untitled. Creation selects an available sibling name with a numeric suffix when needed. Names are trimmed and NFC-normalized. Derived URL slugs must be unique across sibling entries and collections, including case and punctuation variants. Names cannot contain a slash or equal a single dot or two dots. Restricted collections require a session with restricted_collections permission and the Pro plan; API keys cannot create them.",
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
          parentID: id().describe("ID of the parent collection"),
          parentPath: contentPathType.describe("Name path of the parent collection"),
          parentSlugPath: contentSlugPathType.describe("Slug path of the parent collection"),
          restricted: z.boolean().describe("Whether to restrict access to the collection tree")
        })
        .partial()
        .refine(hasOptionalParentSelector, {
          message: "Use only one of parentID, parentPath, or parentSlugPath",
          path: ["parentID"]
        })
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
    .errors(contentPreconditionErrors)
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
        name: collectionName().optional().describe("New name of the collection"),
        expectedName: collectionName().optional().describe("Name the collection must still have")
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
  move: authenticatedContract
    .errors(contentNameErrors)
    .errors(schemaMigrationErrors)
    .errors(contentPreconditionErrors)
    .route({
      summary: "Move a collection",
      description:
        "Moves the collection to another parent or position. Without a new parent, it stays in its parent. Without index, it keeps its position in the same parent and goes last in a new one. Rejects names already used in the new parent. A move that changes the schema can start a schema migration, which needs confirmedDataLoss when it can remove content.",
      tags: ["collections"],
      method: "POST",
      path: "/{id}/move"
    })
    .meta({ example: { id: "coll_example", newParentID: "coll_parent" } })
    .meta({ required: { session: true, key: ["collections"] } })
    .input(
      z
        .object({
          id: id().describe("ID of the collection to be moved"),
          newParentID: id()
            .nullable()
            .optional()
            .describe("ID of the new parent collection, or null for the top level"),
          newParentPath: contentPathType
            .optional()
            .describe("Name path of the new parent collection; / is the top level"),
          newParentSlugPath: contentSlugPathType
            .optional()
            .describe("Slug path of the new parent collection; / is the top level"),
          expectedParentID: id()
            .nullable()
            .optional()
            .describe(
              "ID of the parent that must still contain the collection, or null for the top level"
            ),
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
        .refine(
          (input) => {
            return (
              [input.newParentID, input.newParentPath, input.newParentSlugPath].filter(
                (value) => value !== undefined
              ).length <= 1
            );
          },
          {
            message: "Use only one of newParentID, newParentPath, or newParentSlugPath",
            path: ["newParentID"]
          }
        )
    )
    .output(
      z.object({
        migrationID: id().nullable(),
        totalEntries: z.number().int().nonnegative()
      })
    ),
  get: authenticatedContract
    .route({
      summary: "Get a collection",
      description:
        "Returns one collection by collectionID, collectionPath, or collectionSlugPath, with its name, path, and ancestors.",
      tags: ["collections"],
      method: "GET",
      path: "/get"
    })
    .meta({ example: { collectionID: "coll_example" } })
    .meta({ required: { session: true, key: ["read:collections"] } })
    .input(
      z.object(collectionSelectorShape).refine(hasCollectionSelector, {
        message: "Use one of collectionID, collectionPath, or collectionSlugPath"
      })
    )
    .output(publicCollectionType),
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
          message: "Use only one collectionID, collectionPath, or collectionSlugPath"
        })
    )
    .output(collectionListType)
});

export { collectionsContract };
