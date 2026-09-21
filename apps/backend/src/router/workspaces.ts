import { getUserAuthorization } from "#backend/lib/policy";
import { emitWorkspaceStateEvent } from "#backend/events";
import { auth } from "#backend/lib/adapters";
import { toUserID, toUUID } from "#backend/lib/primitives";
import {
  enqueueCurrentEntrySync,
  enqueueCurrentWorkspacePurge,
  enqueuePublishedWorkspacePurge
} from "#backend/lib/queue";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Auth } from "#backend/services/auth";
import { Billing } from "#backend/services/billing";
import { Workspaces } from "#backend/services/workspaces";
import { api } from "./implement";

const handlers = api.workspaces;
const authorizedHandlers = handlers.use(authorized);
const workspacesRouter = handlers.router({
  list: authorizedHandlers.list.handler(async ({ context }) => {
    const userID = getUserAuthorization(context.auth)!.userID;
    const sessions =
      context.auth.type === "oauth"
        ? []
        : await auth.api.listDeviceSessions({
            headers: new Headers({ cookie: context.reqHeaders?.get("cookie") || "" })
          });

    const { workspaces } = await Workspaces.list({
      activeUserID: userID,
      userIDs:
        context.auth.type === "oauth"
          ? [userID]
          : sessions.map((session) => toUserID(toUUID(session.user.id)))
    });

    context.resHeaders?.set("Cache-Control", "private, no-store");

    return workspaces;
  }),
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const newWorkspace = await Workspaces.create({
      name: input.name,
      userID: context.auth.session!.userID
    });

    await auth.api.updateUser({
      headers: new Headers({ cookie: context.reqHeaders?.get("cookie") || "" }),
      body: {
        currentWorkspaceID: newWorkspace.id
      }
    });
    emitWorkspaceStateEvent(newWorkspace.id, {
      action: "workspace:create",
      data: newWorkspace
    });

    return newWorkspace;
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    if (input.name === undefined) return;

    await Workspaces.update({
      auth: context.auth,
      name: input.name
    });

    emitWorkspaceStateEvent(context.auth.workspaceID, {
      action: "workspace:update",
      memberID: getUserAuthorization(context.auth)?.memberID,
      data: {
        id: context.auth.workspaceID,
        name: input.name
      }
    });
  }),
  delete: authorizedHandlers.delete.handler(async ({ context }) => {
    const { deletingAt } = await Workspaces.beginDeletion({
      auth: context.auth
    });

    try {
      await Auth.invalidateSessionData({ workspaceID: context.auth.workspaceID });
      await Billing.settle({
        workspaceID: context.auth.workspaceID
      });
    } catch (error) {
      await Workspaces.cancelDeletion({
        deletingAt,
        workspaceID: context.auth.workspaceID
      });
      throw error;
    }

    const { entryIDs, ...result } = await Workspaces.delete({
      auth: context.auth
    });

    emitWorkspaceStateEvent(context.auth.workspaceID, {
      action: "workspace:delete",
      memberID: getUserAuthorization(context.auth)?.memberID,
      data: {
        id: context.auth.workspaceID,
        entryIDs
      }
    });
    await Promise.all([
      enqueueCurrentEntrySync({
        workspaceID: context.auth.workspaceID,
        entryIDs
      }),
      enqueueCurrentWorkspacePurge({ workspaceID: context.auth.workspaceID }),
      enqueuePublishedWorkspacePurge({ workspaceID: context.auth.workspaceID })
    ]);

    return result;
  }),
  switch: authorizedHandlers.switch.handler(({ context, input }) => {
    return Workspaces.switch({
      headers: new Headers({ cookie: context.reqHeaders?.get("cookie") || "" }),
      workspaceID: input.workspaceID,
      userID: context.auth.session!.userID
    });
  })
});

export { workspacesRouter };
