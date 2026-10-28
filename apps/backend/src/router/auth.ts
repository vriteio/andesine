import { emitMembershipEvent, emitWorkspaceStateEvent } from "#backend/events";
import { getUserAuthorization } from "#backend/lib/policy";
import { Auth } from "#backend/services/auth";
import { Billing } from "#backend/services/billing";
import { Workspaces } from "#backend/services/workspaces";
import { verifyOTPToken } from "#backend/lib/security";
import { authorized } from "#backend/lib/transport";
import { deleteAnalyticsPerson, trackEvent } from "#backend/lib/analytics";
import { assertExpectedUser } from "#backend/lib/auth/expected-user";
import { api } from "./implement";

const handlers = api.auth;
const authorizedHandlers = handlers.use(authorized);
const authRouter = handlers.router({
  getDeviceRequest: authorizedHandlers.getDeviceRequest.handler(({ context, input }) => {
    context.resHeaders?.set("Cache-Control", "private, no-store");

    return Auth.OAuth.getDeviceRequest({
      ...input,
      auth: context.auth,
      headers: context.reqHeaders!
    });
  }),
  respondToDeviceRequest: authorizedHandlers.respondToDeviceRequest.handler(
    ({ context, input }) => {
      context.resHeaders?.set("Cache-Control", "private, no-store");

      return Auth.OAuth.respondToDeviceRequest({
        ...input,
        auth: context.auth,
        headers: context.reqHeaders!
      });
    }
  ),
  listConnectedApps: authorizedHandlers.listConnectedApps.handler(({ context }) => {
    context.resHeaders?.set("Cache-Control", "private, no-store");

    return Auth.OAuth.listConnectedApps({ userID: context.auth.session!.userID });
  }),
  revokeConnectedApp: authorizedHandlers.revokeConnectedApp.handler(({ context, input }) => {
    return Auth.OAuth.revokeConnectedApp({ ...input, userID: context.auth.session!.userID });
  }),
  listSoleAdminWorkspaces: authorizedHandlers.listSoleAdminWorkspaces.handler(
    ({ context, input }) => {
      assertExpectedUser(context.auth.session!.userID, input.userID);
      context.resHeaders?.set("Cache-Control", "private, no-store");

      return Workspaces.listSoleAdmin({ userID: input.userID });
    }
  ),
  deleteAccount: authorizedHandlers.deleteAccount.handler(async ({ context, input }) => {
    const { workspaceSessions, remainingMemberships } = await Auth.prepareAccountDeletion({
      headers: context.reqHeaders!,
      userID: input.userID
    });
    const deletions = await Promise.allSettled(
      workspaceSessions.map(async (workspaceSession) => {
        const { entryIDs } = await Workspaces.destroy({ auth: workspaceSession });

        emitWorkspaceStateEvent(workspaceSession.workspaceID, {
          action: "workspace:delete",
          memberID: getUserAuthorization(workspaceSession)?.memberID,
          data: { id: workspaceSession.workspaceID, entryIDs }
        });
        trackEvent("workspace_deleted", workspaceSession);
      })
    );
    const failedDeletion = deletions.find((deletion) => deletion.status === "rejected");

    if (failedDeletion) throw failedDeletion.reason;

    await Auth.deleteUser({ userID: input.userID });

    // The account is already deleted, so its cleanup doesn't hold or fail the response.
    void Promise.allSettled([
      deleteAnalyticsPerson(input.userID),
      ...remainingMemberships.map(async ({ workspaceID, memberID }) => {
        emitMembershipEvent(workspaceID, {
          action: "membership:remove",
          memberID,
          data: { id: memberID }
        });
        await Billing.updateSeats({ workspaceID });
      })
    ]).then((results) => {
      for (const result of results) {
        if (result.status !== "rejected") continue;

        console.error("Failed to clean up deleted account", result.reason);
      }
    });
  }),
  getIdentity: authorizedHandlers.getIdentity.handler(({ context }) => {
    context.resHeaders?.set("Cache-Control", "private, no-store");

    return Auth.getIdentity({ auth: context.auth });
  }),
  session: authorizedHandlers.session.handler(({ context }) => {
    return {
      workspaceID: context.auth.workspaceID,
      subscriptionPlan: context.auth.subscriptionPlan,
      memberID: context.auth.session!.memberID,
      userID: context.auth.session!.userID,
      roleID: context.auth.session!.roleID,
      permissions: context.auth.session!.permissions,
      admin: context.auth.session?.admin === true
    };
  }),
  verifyOTPToken: handlers.verifyOTPToken.handler(({ input }) => {
    return verifyOTPToken({ token: input.token });
  })
});

export { authRouter };
