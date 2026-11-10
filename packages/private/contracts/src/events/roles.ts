import { roleType } from "../entities/roles";
import { id } from "../primitives/id";
import * as z from "zod";

const roleEventType = z.union([
  z.object({
    action: z.literal("role:create"),
    memberID: id().optional(),
    data: roleType
  }),
  z.object({
    action: z.literal("role:update"),
    memberID: id().optional(),
    affectedUserIDs: z.array(id()).optional(),
    data: z.object({
      ...roleType.pick({ id: true }).shape,
      ...roleType.omit({ id: true }).partial().shape
    })
  }),
  z.object({
    action: z.literal("role:delete"),
    memberID: id().optional(),
    affectedUserIDs: z.array(id()).optional(),
    data: z.object({ id: roleType.shape.id })
  })
]);
type RoleEvent = z.infer<typeof roleEventType>;
export { roleEventType };
export type { RoleEvent };
