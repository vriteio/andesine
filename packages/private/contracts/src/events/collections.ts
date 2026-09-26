import { collectionType } from "../entities/collections";
import { id } from "../primitives/id";
import { collectionAccessType } from "../permissions/actions";
import * as z from "zod";

const collectionEventType = z.union([
  z.object({
    action: z.literal("collection:create"),
    memberID: id().optional(),
    access: collectionAccessType.optional(),
    data: collectionType
  }),
  z.object({
    action: z.literal("collection:restore"),
    memberID: id().optional(),
    access: collectionAccessType.optional(),
    data: z.object({
      collection: collectionType,
      parentID: id().nullable(),
      index: z.number().int().min(0)
    })
  }),
  z.object({
    action: z.literal("collection:update"),
    memberID: id().optional(),
    data: z.object({
      ...collectionType.pick({ id: true }).shape,
      ...collectionType.omit({ id: true }).partial().shape
    })
  }),
  z.object({
    action: z.literal("collection:reorder"),
    memberID: id().optional(),
    data: z.object({
      parentID: id().nullable(),
      descendants: z.array(id())
    })
  }),
  z.object({
    action: z.literal("collection:delete"),
    memberID: id().optional(),
    data: z.object({ ids: z.array(id()) })
  }),
  z.object({
    action: z.literal("collection:move"),
    memberID: id().optional(),
    data: z.object({
      id: id(),
      newParentID: id().nullable().optional(),
      index: z.number().int().min(0).optional(),
      restrictedBoundaryChanged: z.boolean()
    })
  })
]);
type CollectionEvent = z.infer<typeof collectionEventType>;
export { collectionEventType };
export type { CollectionEvent };
