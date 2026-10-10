import { emitExtensionEvent } from "#backend/events";
import { config } from "#backend/lib/config";
import { getUserAuthorization } from "#backend/lib/policy";
import { enforceRateLimit } from "#backend/lib/security";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Auth } from "#backend/services/auth";
import { Extensions } from "#backend/services/extensions";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";

const APP_TOKEN_LIMIT = { max: 60, window: 60 };

const handlers = api.extensions;
const authorizedHandlers = handlers.use(authorized);
const assertExtensionsEnabled = (): void => {
  if (!config.PUBLIC_EXTENSIONS_ENABLED) throw new ORPCError("NOT_FOUND");
};
// Hosted instances never enable development, so they expose no development endpoints.
const assertDevelopmentEnabled = (): void => {
  if (!config.PUBLIC_EXTENSIONS_ENABLED || !config.EXTENSIONS_DEVELOPMENT_ENABLED) {
    throw new ORPCError("NOT_FOUND");
  }
};
const extensionsRouter = handlers.router({
  getSelf: authorizedHandlers.getSelf.handler(({ context }) => {
    assertExtensionsEnabled();

    return Extensions.getSelf({ auth: context.auth });
  }),
  verifySession: authorizedHandlers.verifySession.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.verifySession({ auth: context.auth, ...input });
  }),
  // App-level tokens have no installation, so this operation verifies them itself.
  listInstallations: handlers.listInstallations.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const token = /^Bearer\s+(\S+)$/i.exec(context.reqHeaders?.get("authorization") ?? "")?.[1];

    if (!token) throw new ORPCError("UNAUTHORIZED");

    const { name } = await Auth.verifyExtensionAppToken(token);

    await enforceRateLimit({
      scope: "extension-app",
      key: name,
      limit: APP_TOKEN_LIMIT,
      message: "Too many requests. Try again later.",
      headers: context.resHeaders
    });

    return Extensions.listInstallations({ name, ...input });
  }),
  getSelfDelivery: authorizedHandlers.getSelfDelivery.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.getSelfDelivery({ auth: context.auth, ...input });
  }),
  getSelfConfiguration: authorizedHandlers.getSelfConfiguration.handler(({ context }) => {
    assertExtensionsEnabled();

    return Extensions.getSelfConfiguration({ auth: context.auth });
  }),
  getSelfStorageEntry: authorizedHandlers.getSelfStorageEntry.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.storage.get({ auth: context.auth, ...input });
  }),
  setSelfStorageEntry: authorizedHandlers.setSelfStorageEntry.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.storage.set({ auth: context.auth, ...input });
  }),
  deleteSelfStorageEntry: authorizedHandlers.deleteSelfStorageEntry.handler(
    ({ context, input }) => {
      assertExtensionsEnabled();

      return Extensions.storage.delete({ auth: context.auth, ...input.query });
    }
  ),
  listSelfStorageEntries: authorizedHandlers.listSelfStorageEntries.handler(
    ({ context, input }) => {
      assertExtensionsEnabled();

      return Extensions.storage.list({ auth: context.auth, ...input });
    }
  ),
  getStorageEntry: authorizedHandlers.getStorageEntry.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.storage.get({ auth: context.auth, ...input });
  }),
  setStorageEntry: authorizedHandlers.setStorageEntry.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.storage.set({ auth: context.auth, ...input });
  }),
  deleteStorageEntry: authorizedHandlers.deleteStorageEntry.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.storage.delete({ auth: context.auth, ...input });
  }),
  listStorageEntries: authorizedHandlers.listStorageEntries.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.storage.list({ auth: context.auth, ...input });
  }),
  getConfiguration: authorizedHandlers.getConfiguration.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.getConfiguration({ auth: context.auth, ...input });
  }),
  setConfiguration: authorizedHandlers.setConfiguration.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.setConfiguration({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:update",
      memberID: context.auth.session?.memberID,
      data: { id: input.extensionID }
    });

    return result;
  }),
  listCatalog: authorizedHandlers.listCatalog.handler(({ context }) => {
    assertExtensionsEnabled();

    return Extensions.listCatalog({ auth: context.auth });
  }),
  getCatalogItem: authorizedHandlers.getCatalogItem.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.getCatalogItem({ auth: context.auth, ...input });
  }),
  list: authorizedHandlers.list.handler(({ context }) => {
    assertExtensionsEnabled();

    return Extensions.list({ auth: context.auth });
  }),
  get: authorizedHandlers.get.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.get({ auth: context.auth, ...input });
  }),
  listRuntime: authorizedHandlers.listRuntime.handler(({ context }) => {
    assertExtensionsEnabled();

    return Extensions.listRuntime({ auth: context.auth });
  }),
  install: authorizedHandlers.install.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.install({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:create",
      memberID: context.auth.session?.memberID,
      data: { id: result.id }
    });

    return result;
  }),
  setEnabled: authorizedHandlers.setEnabled.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.setEnabled({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:update",
      memberID: context.auth.session?.memberID,
      data: { id: result.id }
    });

    return result;
  }),
  approve: authorizedHandlers.approve.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.approve({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:update",
      memberID: context.auth.session?.memberID,
      data: { id: result.id }
    });

    return result;
  }),
  uninstall: authorizedHandlers.uninstall.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.uninstall({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:delete",
      memberID: context.auth.session?.memberID,
      data: { id: result.id }
    });

    return result;
  }),
  listWebhooks: authorizedHandlers.listWebhooks.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.listWebhooks({ auth: context.auth, ...input });
  }),
  setWebhookEnabled: authorizedHandlers.setWebhookEnabled.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.setWebhookEnabled({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:update",
      memberID: context.auth.session?.memberID,
      data: { id: input.extensionID }
    });

    return result;
  }),
  redeliverWebhook: authorizedHandlers.redeliverWebhook.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.redeliverWebhook({ auth: context.auth, ...input });
  }),
  uploadDevelopment: authorizedHandlers.uploadDevelopment.handler(async ({ context, input }) => {
    assertDevelopmentEnabled();

    const result = await Extensions.development.upload({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:update",
      memberID: getUserAuthorization(context.auth)?.memberID,
      data: { id: result.id }
    });

    return result;
  }),
  stopDevelopment: authorizedHandlers.stopDevelopment.handler(async ({ context, input }) => {
    assertDevelopmentEnabled();

    const result = await Extensions.development.stop({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:update",
      memberID: getUserAuthorization(context.auth)?.memberID,
      data: { id: result.id }
    });

    return result;
  }),
  removeDevelopment: authorizedHandlers.removeDevelopment.handler(async ({ context, input }) => {
    assertDevelopmentEnabled();

    const result = await Extensions.development.remove({ auth: context.auth, ...input });

    emitExtensionEvent(context.auth.workspaceID, {
      action: "extension:delete",
      memberID: getUserAuthorization(context.auth)?.memberID,
      data: { id: result.id }
    });

    return result;
  }),
  getDevelopmentArtifact: handlers.getDevelopmentArtifact.handler(async ({ input }) => {
    assertDevelopmentEnabled();

    return {
      headers: {
        "Cache-Control": "private, no-store" as const,
        "X-Content-Type-Options": "nosniff" as const
      },
      body: await Extensions.development.getArtifact(input)
    };
  }),
  sendWebhookTest: authorizedHandlers.sendWebhookTest.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.sendWebhookTest({ auth: context.auth, ...input });
  }),
  listWebhookDeliveries: authorizedHandlers.listWebhookDeliveries.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.webhookHistory.listDeliveries({ auth: context.auth, ...input });
  }),
  getWebhookDelivery: authorizedHandlers.getWebhookDelivery.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.webhookHistory.getDelivery({ auth: context.auth, ...input });
  }),
  listWebhookRuns: authorizedHandlers.listWebhookRuns.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.webhookHistory.listRuns({ auth: context.auth, ...input });
  }),
  listWebhookAttempts: authorizedHandlers.listWebhookAttempts.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.webhookHistory.listAttempts({ auth: context.auth, ...input });
  }),
  listActiveViews: authorizedHandlers.listActiveViews.handler(({ context }) => {
    assertExtensionsEnabled();

    return Extensions.listActiveViews({ auth: context.auth });
  }),
  listElementViews: authorizedHandlers.listElementViews.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.listElementViews({ auth: context.auth, ...input });
  }),
  setElementViewEnabled: authorizedHandlers.setElementViewEnabled.handler(
    async ({ context, input }) => {
      assertExtensionsEnabled();

      const result = await Extensions.setElementViewEnabled({ auth: context.auth, ...input });
      const memberID = context.auth.session?.memberID;
      const changed = [input.extensionID, result.replacedExtensionID].filter(Boolean);

      for (const id of changed) {
        emitExtensionEvent(context.auth.workspaceID, {
          action: "extension:update",
          memberID,
          data: { id: id! }
        });
      }

      return { revision: result.revision };
    }
  ),
  createSessionToken: authorizedHandlers.createSessionToken.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.createSessionToken({ auth: context.auth, ...input });
  })
});

export { extensionsRouter };
