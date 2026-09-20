import { verifyOTPToken } from "#backend/lib/security";
import { authorized } from "#backend/lib/transport";
import { api } from "./implement";

const handlers = api.auth;
const authorizedHandlers = handlers.use(authorized);
const authRouter = handlers.router({
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
