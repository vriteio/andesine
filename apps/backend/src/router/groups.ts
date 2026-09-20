import { emitGroupEvent } from "#backend/events";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Groups } from "#backend/services/groups";
import { api } from "./implement";

const handlers = api.groups;
const authorizedHandlers = handlers.use(authorized);
const groupsRouter = handlers.router({
  list: authorizedHandlers.list.handler(async ({ context }) => {
    const { groups } = await Groups.list({ auth: context.auth });

    return groups;
  }),
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    const { affectedUserIDs: _, ...group } = await Groups.create({
      invitationIDs: input.invitationIDs,
      auth: context.auth,
      memberIDs: input.memberIDs,
      name: input.name
    });

    emitGroupEvent(context.auth.workspaceID, {
      action: "group:create",
      memberID: context.auth.session?.memberID,
      data: group
    });

    return group;
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    const { affectedUserIDs, invitationIDs, memberIDs, name } = await Groups.update({
      id: input.id,
      auth: context.auth,
      invitationIDs: input.invitationIDs,
      memberIDs: input.memberIDs,
      name: input.name
    });

    emitGroupEvent(context.auth.workspaceID, {
      action: "group:update",
      affectedUserIDs,
      memberID: context.auth.session?.memberID,
      data: { id: input.id, invitationIDs, memberIDs, name }
    });
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    const { affectedUserIDs } = await Groups.delete({
      id: input.id,
      auth: context.auth
    });

    emitGroupEvent(context.auth.workspaceID, {
      action: "group:delete",
      affectedUserIDs,
      memberID: context.auth.session?.memberID,
      data: { id: input.id }
    });
  })
});

export { groupsRouter };
