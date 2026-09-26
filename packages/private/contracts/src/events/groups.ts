import { groupType } from "../entities/groups";
import { id } from "../primitives/id";
import * as z from "zod";

const groupEventType = z.union([
  z.object({
    action: z.literal("group:create"),
    memberID: id().optional(),
    data: groupType.extend({
      memberIDs: z.array(id()),
      invitationIDs: z.array(id())
    })
  }),
  z.object({
    action: z.literal("group:update"),
    memberID: id().optional(),
    affectedUserIDs: z.array(id()).optional(),
    data: groupType.extend({
      memberIDs: z.array(id()),
      invitationIDs: z.array(id())
    })
  }),
  z.object({
    action: z.literal("group:delete"),
    memberID: id().optional(),
    affectedUserIDs: z.array(id()).optional(),
    data: z.object({ id: groupType.shape.id })
  }),
  z.object({
    action: z.literal("group:members-update"),
    memberID: id().optional(),
    affectedUserIDs: z.array(id()).optional(),
    data: z.object({
      id: groupType.shape.id,
      memberIDs: z.array(id()),
      invitationIDs: z.array(id())
    })
  }),
  z.object({
    action: z.literal("restricted-assignments:update"),
    memberID: id().optional(),
    affectedUserIDs: z.array(id()).optional(),
    data: z.object({ collectionID: id() })
  })
]);
type GroupEvent = z.infer<typeof groupEventType>;
export { groupEventType };
export type { GroupEvent };
