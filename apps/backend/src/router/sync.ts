import { authorized } from "#backend/lib/transport/middleware/authorized";
import { shutdownSignal } from "#backend/lib/transport/shutdown";
import { Memberships } from "#backend/services/memberships";
import { Sync } from "#backend/services/sync";
import { api } from "./implement";

const handlers = api.sync;
const authorizedHandlers = handlers.use(authorized);
const syncRouter = handlers.router({
  setCurrentEntry: authorizedHandlers.setCurrentEntry.handler(({ context, input }) => {
    return Memberships.setCurrentEntry({
      auth: context.auth,
      entryID: input.entryID
    });
  }),
  getExplorerTree: authorizedHandlers.getExplorerTree.handler(async ({ context }) => {
    return Sync.getExplorerTree({
      auth: context.auth,
      includePublishing: true
    });
  }),
  getExplorerOverlay: authorizedHandlers.getExplorerOverlay.handler(({ context, input }) => {
    return Sync.getExplorerOverlay({
      auth: context.auth,
      channel: input.channel
    });
  }),
  getPublishingStatus: authorizedHandlers.getPublishingStatus.handler(
    async ({ context, input }) => {
      return Sync.getPublishingStatus({
        auth: context.auth,
        channel: input.channel
      });
    }
  ),
  workspaceUpdates: authorizedHandlers.workspaceUpdates.handler(async function* ({
    context,
    signal
  }) {
    const { events } = await Sync.listenToWorkspaceEvents({
      auth: context.auth,
      signal: signal ? AbortSignal.any([signal, shutdownSignal]) : shutdownSignal
    });

    yield* events;
  })
});

export { syncRouter };
