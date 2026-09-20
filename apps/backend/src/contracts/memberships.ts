import { pageInputType, paginationType } from "./schemas/pagination";
import { membershipInviteErrors } from "./errors";
import { id } from "#backend/lib/primitives";
import * as z from "zod";
import { authenticatedContract, baseContract, sessionContract } from "./base";
import {
  acceptedInviteType,
  inviteDeliveryResultType,
  inviteDetailsType,
  memberDetailsType,
  membershipInviteResultType
} from "./schemas/memberships";

const membershipsContract = baseContract.prefix("/memberships").router({
  list: authenticatedContract
    .route({
      summary: "List workspace members",
      description:
        "Lists workspace memberships with role and user details. Use pagination.nextCursor to continue with the same filters; concurrent changes can affect later pages.",
      tags: ["memberships"],
      method: "GET",
      path: "/"
    })
    .meta({ example: {} })
    .meta({ required: { session: true, key: ["read:memberships"] } })
    .input(pageInputType)
    .output(z.object({ data: z.array(memberDetailsType), pagination: paginationType })),
  update: authenticatedContract
    .route({
      summary: "Change a member role",
      description:
        "Assigns a new role to a member. Requires the Pro plan and permission to delegate that role. Administrator assignments have additional restrictions.",
      tags: ["memberships"],
      method: "PATCH",
      path: "/{id}"
    })
    .meta({ example: { id: "ms_example", roleID: "rl_example" } })
    .meta({ required: { session: true, key: ["memberships"] } })
    .input(
      z.object({
        id: id().describe("ID of the membership to update"),
        roleID: id().describe("New role ID")
      })
    )
    .output(z.void()),
  remove: authenticatedContract
    .route({
      summary: "Remove a workspace member",
      description:
        "Removes the membership and its workspace access. Administrator memberships have additional restrictions.",
      tags: ["memberships"],
      method: "DELETE",
      path: "/{id}"
    })
    .meta({ example: { id: "ms_example" } })
    .meta({ required: { session: true, key: ["memberships"] } })
    .input(
      z.object({
        id: id().describe("ID of the membership to remove")
      })
    )
    .output(z.void()),
  invite: authenticatedContract
    .errors(membershipInviteErrors)
    .route({
      summary: "Invite a workspace member",
      description:
        "Creates an invitation and attempts email delivery. Check emailDelivery in the result. Requires the Pro plan and permission to delegate the selected role. Existing membership or pending invitation returns a conflict.",
      tags: ["memberships"],
      method: "POST",
      path: "/"
    })
    .meta({ example: { email: "editor@example.com", roleID: "rl_example" } })
    .meta({ required: { session: true, key: ["memberships"] } })
    .input(
      z.object({
        email: z.email().describe("Email address of the user to invite"),
        roleID: id().describe("ID of the role to assign")
      })
    )
    .output(membershipInviteResultType),
  listInvites: authenticatedContract
    .route({
      summary: "List invitations",
      description:
        "Lists pending, unexpired workspace invitations. Use pagination.nextCursor to continue. Requires the Pro plan.",
      tags: ["memberships"],
      method: "GET",
      path: "/invites"
    })
    .meta({ example: {} })
    .meta({ required: { session: true, key: ["memberships"] } })
    .input(pageInputType)
    .output(z.object({ data: z.array(inviteDetailsType), pagination: paginationType })),
  resendInvite: authenticatedContract
    .route({
      summary: "Resend an invitation",
      description:
        "Attempts email delivery again for a pending invitation. Check emailDelivery in the result. Requires the Pro plan.",
      tags: ["memberships"],
      method: "POST",
      path: "/invites/{id}/resend"
    })
    .meta({ example: { id: "inv_example" } })
    .meta({ required: { session: true, key: ["memberships"] } })
    .input(
      z.object({
        id: id().describe("ID of the pending invitation")
      })
    )
    .output(inviteDeliveryResultType),
  revokeInvite: authenticatedContract
    .route({
      summary: "Revoke an invitation",
      description:
        "Revokes a pending invitation so it can no longer be accepted. Requires the Pro plan.",
      tags: ["memberships"],
      method: "DELETE",
      path: "/invites/{id}"
    })
    .meta({ example: { id: "inv_example" } })
    .meta({ required: { session: true, key: ["memberships"] } })
    .input(
      z.object({
        id: id().describe("ID of the invite to revoke")
      })
    )
    .output(z.void()),
  acceptInvite: sessionContract
    .route({
      method: "POST",
      path: "/accept"
    })
    .meta({ requireWorkspace: false })
    .input(
      z.object({
        id: id().describe("ID of the invitation"),
        expires: z.number().int().positive().describe("Signed URL expiration time"),
        signature: z.string().length(64).describe("HMAC signature for the invitation URL")
      })
    )
    .output(acceptedInviteType)
});

export { membershipsContract };
