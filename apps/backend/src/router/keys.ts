import { emitKeyEvent } from "#backend/events";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Auth } from "#backend/services/auth";
import { Keys } from "#backend/services/keys";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";

const handlers = api.keys;
const authorizedHandlers = handlers.use(authorized);
const keysRouter = handlers.router({
  create: authorizedHandlers.create.handler(async ({ context, input }) => {
    if (!context.auth.session) {
      throw new ORPCError("FORBIDDEN", {
        message: "Session authentication is required to create an API key"
      });
    }

    const key = await Keys.create({
      auth: context.auth,
      name: input.name,
      permissions: input.permissions
    });

    const { rawKey: _rawKey, ...safeKey } = key;

    emitKeyEvent(context.auth.workspaceID, {
      action: "key:create",
      memberID: context.auth.session.memberID,
      data: safeKey
    });

    return key;
  }),
  get: authorizedHandlers.get.handler(({ context, input }) => {
    return Keys.get({
      keyID: input.id,
      auth: context.auth
    });
  }),
  list: authorizedHandlers.list.handler(async ({ context }) => {
    const { keys } = await Keys.list({
      auth: context.auth
    });

    return keys;
  }),
  delete: authorizedHandlers.delete.handler(async ({ context, input }) => {
    await Keys.delete({
      ids: input.ids,
      auth: context.auth
    });
    await Promise.all(input.ids.map((keyID) => Auth.invalidateSessionData({ keyID })));

    emitKeyEvent(context.auth.workspaceID, {
      action: "key:delete",
      memberID: context.auth.session?.memberID,
      data: {
        ids: input.ids
      }
    });
  }),
  update: authorizedHandlers.update.handler(async ({ context, input }) => {
    await Keys.update({
      id: input.id,
      auth: context.auth,
      name: input.name,
      permissions: input.permissions
    });

    if (input.permissions !== undefined) {
      await Auth.invalidateSessionData({ keyID: input.id });
    }

    emitKeyEvent(context.auth.workspaceID, {
      action: "key:update",
      memberID: context.auth.session?.memberID,
      data: {
        id: input.id,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.permissions !== undefined && { permissions: input.permissions })
      }
    });
  }),
  rotate: authorizedHandlers.rotate.handler(async ({ context, input }) => {
    if (!context.auth.session) {
      throw new ORPCError("FORBIDDEN", {
        message: "Session authentication is required to rotate an API key"
      });
    }

    const key = await Keys.rotate({
      id: input.id,
      auth: context.auth,
      expiresIn: input.expiresIn
    });

    await Auth.invalidateSessionData({ keyID: input.id });

    const { rawKey: _rawKey, ...safeKey } = key;

    emitKeyEvent(context.auth.workspaceID, {
      action: "key:rotate",
      memberID: context.auth.session.memberID,
      data: {
        previousKeyID: input.id,
        key: safeKey
      }
    });

    return key;
  })
});

export { keysRouter };
