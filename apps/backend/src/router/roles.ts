import { emitRoleEvent } from "#backend/events";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Auth } from "#backend/services/auth";
import { Roles } from "#backend/services/roles";
import { api } from "./implement";

const handlers = api.roles;
const authorizedHandlers = handlers.use(authorized);
const rolesRouter = handlers.router({
  list: authorizedHandlers.list.handler(async ({ context }) => {
    const { roles } = await Roles.list({
      auth: context.auth
    });

    return roles;
  }),
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const newRole = await Roles.create({
      auth: context.auth,
      name: input.name,
      permissions: input.permissions
    });

    emitRoleEvent(context.auth.workspaceID, {
      action: "role:create",
      memberID: context.auth.session?.memberID,
      data: newRole
    });

    return newRole;
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    const { affectedUserIDs } = await Roles.update({
      id: input.id,
      auth: context.auth,
      name: input.name,
      permissions: input.permissions
    });

    await Promise.all(
      affectedUserIDs.map((userID) =>
        Auth.invalidateSessionData({ userID, workspaceID: context.auth.workspaceID })
      )
    );

    emitRoleEvent(context.auth.workspaceID, {
      action: "role:update",
      affectedUserIDs,
      memberID: context.auth.session?.memberID,
      data: {
        id: input.id,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.permissions !== undefined && { permissions: input.permissions })
      }
    });
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    const { affectedUserIDs } = await Roles.delete({
      id: input.id,
      auth: context.auth
    });

    await Promise.all(
      affectedUserIDs.map((userID) =>
        Auth.invalidateSessionData({ userID, workspaceID: context.auth.workspaceID })
      )
    );

    emitRoleEvent(context.auth.workspaceID, {
      action: "role:delete",
      affectedUserIDs,
      memberID: context.auth.session?.memberID,
      data: {
        id: input.id
      }
    });
  })
});

export { rolesRouter };
