import { inviteType } from "../entities/invitations";
import { membershipType } from "../entities/memberships";
import { id } from "../primitives/id";
import * as z from "zod";

const membershipEventType = z.union([
  z.object({
    action: z.literal("membership:add"),
    memberID: id().optional(),
    data: membershipType
  }),
  z.object({
    action: z.literal("membership:update"),
    memberID: id().optional(),
    data: z.object({
      ...membershipType.pick({ id: true }).shape,
      ...membershipType.omit({ id: true }).partial().shape
    })
  }),
  z.object({
    action: z.literal("membership:remove"),
    memberID: id().optional(),
    data: z.object({ id: membershipType.shape.id })
  }),
  z.object({
    action: z.literal("invite:create"),
    memberID: id().optional(),
    data: inviteType
  }),
  z.object({
    action: z.literal("invite:revoke"),
    memberID: id().optional(),
    data: z.object({ id: inviteType.shape.id })
  })
]);
type MembershipEvent = z.infer<typeof membershipEventType>;
export { membershipEventType };
export type { MembershipEvent };
