import { id } from "../primitives/id";
import * as z from "zod";

const inviteStatusType = z.enum(["pending", "accepted", "expired"]);
const inviteType = z.object({
  id: id().describe("ID of the invite"),
  email: z.email().max(320).describe("Email address of the invited user"),
  roleID: id().describe("ID of the role to assign"),
  invitedBy: id().optional().describe("ID of the member who created the invite"),
  status: inviteStatusType.describe("Current status of the invite"),
  createdAt: z.iso.datetime().describe("When the invite was created"),
  expiresAt: z.iso.datetime().describe("When the invite expires")
});
type Invite = z.infer<typeof inviteType>;
export { inviteStatusType, inviteType };
export type { Invite };
