import { config } from "#backend/lib/config";
import { enforceRateLimit, RATE_LIMITS } from "#backend/lib/security";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { shutdownSignal } from "#backend/lib/transport/shutdown";
import { Auth } from "#backend/services/auth";
import { Shares } from "#backend/services/shares";
import { api } from "./implement";

const handlers = api.shares;
const authorizedHandlers = handlers.use(authorized);
const sharesRouter = handlers.router({
  list: authorizedHandlers.list.handler(async ({ context, input }) => {
    return { data: await Shares.list({ ...input, auth: context.auth }) };
  }),
  listEntries: authorizedHandlers.listEntries.handler(({ context, input }) => {
    return Shares.listEntries({ ...input, auth: context.auth });
  }),
  listVisitors: authorizedHandlers.listVisitors.handler(({ context, input }) => {
    return Shares.listVisitors({ ...input, auth: context.auth });
  }),
  createLink: authorizedHandlers.createLink.handler(({ context, input }) => {
    return Shares.createLink({ ...input, auth: context.auth });
  }),
  invite: authorizedHandlers.invite.handler(async ({ context, input }) => {
    // Each invite sends an email; workspace invites share the budget.
    await enforceRateLimit({
      scope: "invitations",
      key: context.auth.workspaceID,
      limit: RATE_LIMITS.invitations,
      message: "Too many invitations. Try again later.",
      headers: context.resHeaders
    });

    return Shares.invite({ ...input, auth: context.auth });
  }),
  update: authorizedHandlers.update.handler(({ context, input }) => {
    return Shares.update({ ...input, auth: context.auth });
  }),
  deleteMany: authorizedHandlers.deleteMany.handler(({ context, input }) => {
    return Shares.deleteMany({ ...input, auth: context.auth });
  }),
  getPolicy: authorizedHandlers.getPolicy.handler(({ context }) => {
    return Shares.getPolicy({ auth: context.auth });
  }),
  updatePolicy: authorizedHandlers.updatePolicy.handler(({ context, input }) => {
    return Shares.updatePolicy({ ...input, auth: context.auth });
  }),
  // Open to everyone; a signed-in account joins as itself.
  join: handlers.join.handler(async ({ context, input }) => {
    const userID = await Auth.getSessionData({
      headers: context.reqHeaders!,
      requireWorkspace: false
    }).then(
      (auth) => auth.session?.userID,
      () => undefined
    );

    return Shares.join({ ...input, userID, clientIP: context.reqHeaders!.get("x-client-ip")! });
  }),
  current: authorizedHandlers.current.handler(({ context }) => {
    return Shares.current({ auth: context.auth });
  }),
  rename: authorizedHandlers.rename.handler(({ context, input }) => {
    return Shares.rename({ ...input, auth: context.auth });
  }),
  extensions: authorizedHandlers.extensions.handler(({ context }) => {
    if (!config.PUBLIC_EXTENSIONS_ENABLED) {
      return { runtime: [], activeViews: [], configurations: {} };
    }

    return Shares.listExtensions({ auth: context.auth });
  }),
  getAsset: authorizedHandlers.getAsset.handler(({ context, input }) => {
    return Shares.getAsset({ ...input, auth: context.auth });
  }),
  events: authorizedHandlers.events.handler(async function* ({ context, signal }) {
    const { events } = await Shares.listen({
      auth: context.auth,
      headers: context.reqHeaders!,
      signal: signal ? AbortSignal.any([signal, shutdownSignal]) : shutdownSignal
    });

    yield* events;
  })
});

export { sharesRouter };
