import { emitGroupEvent, emitMembershipEvent } from "#backend/events";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Auth } from "#backend/services/auth";
import { Billing } from "#backend/services/billing";
import { Memberships } from "#backend/services/memberships";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";
const emitUpdatedGroups = (input: {
  groups: Array<{ id: string; invitationIDs: string[]; memberIDs: string[] }>;
  memberID?: string;
  workspaceID: string;
}): void => {
  for (const group of input.groups) {
    emitGroupEvent(input.workspaceID, {
      action: "group:members-update",
      memberID: input.memberID,
      data: {
        id: group.id,
        invitationIDs: group.invitationIDs,
        memberIDs: group.memberIDs
      }
    });
  }
};
const handlers = api.memberships;
const authorizedHandlers = handlers.use(authorized);
const membershipsRouter = handlers.router({
  list: authorizedHandlers.list.handler(({ context, input }) => {
    return Memberships.list({ ...input, auth: context.auth });
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    const { userID } = await Memberships.update({
      id: input.id,
      auth: context.auth,
      roleID: input.roleID
    });

    await Auth.invalidateSessionData({
      userID,
      workspaceID: context.auth.workspaceID
    });

    emitMembershipEvent(context.auth.workspaceID, {
      action: "membership:update",
      memberID: context.auth.session?.memberID,
      data: {
        id: input.id,
        roleID: input.roleID
      }
    });
  }),
  remove: authorizedHandlers.remove.handler(async ({ context, input }) => {
    const { userID } = await Memberships.remove({
      id: input.id,
      auth: context.auth
    });

    await Auth.invalidateSessionData({
      userID,
      workspaceID: context.auth.workspaceID
    });

    emitMembershipEvent(context.auth.workspaceID, {
      action: "membership:remove",
      memberID: context.auth.session?.memberID,
      data: {
        id: input.id
      }
    });

    await Billing.updateSeats({ workspaceID: context.auth.workspaceID });
  }),
  invite: authorizedHandlers.invite.handler(async ({ context, input }) => {
    const newInviteDetails = await Memberships.invite({
      auth: context.auth,
      email: input.email,
      roleID: input.roleID
    });

    emitMembershipEvent(context.auth.workspaceID, {
      action: "invite:create",
      memberID: context.auth.session?.memberID,
      data: newInviteDetails.invite
    });

    return newInviteDetails;
  }),
  listInvites: authorizedHandlers.listInvites.handler(({ context, input }) => {
    return Memberships.listInvites({ ...input, auth: context.auth });
  }),
  resendInvite: authorizedHandlers.resendInvite.handler(async ({ context, input }) => {
    const { emailDelivery } = await Memberships.resendInvite({
      id: input.id,
      auth: context.auth
    });

    return { emailDelivery };
  }),
  revokeInvite: authorizedHandlers.revokeInvite.handler(async ({ context, input }) => {
    const { updatedGroups } = await Memberships.revokeInvite({
      id: input.id,
      auth: context.auth
    });

    emitMembershipEvent(context.auth.workspaceID, {
      action: "invite:revoke",
      memberID: context.auth.session?.memberID,
      data: {
        id: input.id
      }
    });
    emitUpdatedGroups({
      groups: updatedGroups,
      memberID: context.auth.session?.memberID,
      workspaceID: context.auth.workspaceID
    });
  }),
  acceptInvite: authorizedHandlers.acceptInvite.handler(async ({ context, input }) => {
    if (!context.auth.session) {
      throw new ORPCError("FORBIDDEN", {
        message: "User must be authenticated to accept an invite"
      });
    }

    const result = await Memberships.acceptInvite({
      id: input.id,
      expires: input.expires,
      signature: input.signature,
      userID: context.auth.session.userID
    });

    await Auth.invalidateSessionData({
      userID: context.auth.session.userID,
      workspaceID: result.workspaceID
    });
    await Billing.updateSeats({ workspaceID: result.workspaceID });

    emitMembershipEvent(result.workspaceID, {
      action: "membership:add",
      data: result.membership
    });
    emitUpdatedGroups({
      groups: result.updatedGroups,
      workspaceID: result.workspaceID
    });

    return {
      workspaceID: result.workspaceID,
      workspaceName: result.workspaceName
    };
  })
});

export { membershipsRouter };
