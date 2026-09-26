import { entryType } from "../entities/entries";
import { id } from "../primitives/id";
import * as z from "zod";

const entryEventType = z.union([
  z.object({
    action: z.literal("entry:create"),
    memberID: id().optional(),
    data: entryType
  }),
  z.object({
    action: z.literal("entry:restore"),
    memberID: id().optional(),
    data: entryType
  }),
  z.object({
    action: z.literal("entry:update"),
    memberID: id().optional(),
    data: z.object({
      ...entryType.pick({ id: true }).shape,
      ...entryType.omit({ id: true }).partial().shape
    })
  }),
  z.object({
    action: z.literal("entry:content-reset"),
    data: z.object({ id: id() })
  }),
  z.object({
    action: z.literal("entry:delete"),
    memberID: id().optional(),
    data: z.object({ ids: z.array(id()) })
  }),
  z.object({
    action: z.literal("entry:move"),
    memberID: id().optional(),
    data: z.object({
      id: id(),
      collectionID: id().nullable().optional(),
      order: z.string().optional(),
      restrictedBoundaryChanged: z.boolean()
    })
  })
]);
type EntryEvent = z.infer<typeof entryEventType>;
export { entryEventType };
export type { EntryEvent };
