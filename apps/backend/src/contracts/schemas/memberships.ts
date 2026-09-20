import { inviteType } from "#backend/db/invitations";
import { membershipType } from "#backend/db/memberships";
import { userProfileType } from "#backend/db/users";
import { id } from "#backend/lib/primitives";
import * as z from "zod";

const memberDetailsType = membershipType.extend({
  roleName: z.string().optional().describe("Name of the member's assigned role"),
  admin: z.boolean().optional().describe("Whether the member is an admin"),
  profile: userProfileType.describe("Public profile information for the member")
});
const inviteDetailsType = inviteType.extend({
  inviteLink: z.url().describe("Signed URL for accepting the invitation"),
  workspaceID: id().describe("ID of the workspace the invite belongs to")
});
const membershipInviteResultType = z.object({
  inviteID: inviteType.shape.id,
  inviteLink: z.string().url().describe("Invite link that can be shared manually"),
  emailDelivery: z
    .enum(["sent", "manual", "failed"])
    .describe("Whether the invite email was sent, must be shared manually, or failed")
});
const inviteDeliveryResultType = z.object({
  emailDelivery: z
    .enum(["sent", "manual", "failed"])
    .describe("Whether the invitation email was sent, must be shared manually, or failed")
});
const acceptedInviteType = z.object({
  workspaceID: id().describe("ID of the workspace that was joined"),
  workspaceName: z.string().describe("Name of the workspace that was joined")
});
export {
  memberDetailsType,
  inviteDetailsType,
  membershipInviteResultType,
  inviteDeliveryResultType,
  acceptedInviteType
};
