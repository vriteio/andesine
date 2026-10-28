import { emitExtensionEvent, emitKeyEvent } from "#backend/events";
import { config } from "#backend/lib/config";
import { toManagedKey } from "#backend/lib/extensions/publishable-keys";
import { getUserAuthorization, type SessionData } from "#backend/lib/policy";
import { enforceRateLimit } from "#backend/lib/security";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Auth } from "#backend/services/auth";
import { Extensions } from "#backend/services/extensions";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";
import { trackEvent } from "#backend/lib/analytics";

const APP_TOKEN_LIMIT = { max: 60, window: 60 };

const handlers = api.extensions;
const authorizedHandlers = handlers.use(authorized);
const assertExtensionsEnabled = (): void => {
  if (!config.PUBLIC_EXTENSIONS_ENABLED) throw new ORPCError("NOT_FOUND");
};
/** Tells the workspace about a storage write, e.g. by the backend, so views and page conditions follow. */
const emitStorageEvent = (
  auth: SessionData,
  extensionID: string,
  key: string,
  exists: boolean
): void => {
  emitExtensionEvent(auth.workspaceID, {
    action: "extension:storage",
    memberID: auth.session?.memberID,
    data: { id: extensionID, key, exists }
  });
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
  listSelfPublishableKeys: authorizedHandlers.listSelfPublishableKeys.handler(
    async ({ context }) => {
      assertExtensionsEnabled();

      return { data: await Extensions.publishableKeys.list({ auth: context.auth }) };
    }
  ),
  createSelfPublishableKey: authorizedHandlers.createSelfPublishableKey.handler(
    async ({ context, input }) => {
      assertExtensionsEnabled();

      const key = await Extensions.publishableKeys.create({ auth: context.auth, ...input });

      emitKeyEvent(context.auth.workspaceID, { action: "key:create", data: key });

      return toManagedKey(key);
    }
  ),
  updateSelfPublishableKey: authorizedHandlers.updateSelfPublishableKey.handler(
    async ({ context, input }) => {
      assertExtensionsEnabled();

      const key = await Extensions.publishableKeys.update({ auth: context.auth, ...input });

      await Auth.invalidateSessionData({ keyID: input.keyID });

      emitKeyEvent(context.auth.workspaceID, {
        action: "key:update",
        data: { id: key.id, name: key.name, permissions: key.permissions }
      });

      return toManagedKey(key);
    }
  ),
  deleteSelfPublishableKey: authorizedHandlers.deleteSelfPublishableKey.handler(
    async ({ context, input }) => {
      assertExtensionsEnabled();

      const result = await Extensions.publishableKeys.delete({ auth: context.auth, ...input });

      if (result.deleted) {
        await Auth.invalidateSessionData({ keyID: input.keyID });

        emitKeyEvent(context.auth.workspaceID, {
          action: "key:delete",
          data: { ids: [input.keyID] }
        });
      }

      return result;
    }
  ),
  getSelfStorageEntry: authorizedHandlers.getSelfStorageEntry.handler(({ context, input }) => {
    assertExtensionsEnabled();

    return Extensions.storage.get({ auth: context.auth, ...input });
  }),
  setSelfStorageEntry: authorizedHandlers.setSelfStorageEntry.handler(
    async ({ context, input }) => {
      assertExtensionsEnabled();

      const result = await Extensions.storage.set({ auth: context.auth, ...input });

      emitStorageEvent(context.auth, context.auth.extension!.extensionID, input.key, true);

      return result;
    }
  ),
  deleteSelfStorageEntry: authorizedHandlers.deleteSelfStorageEntry.handler(
    async ({ context, input }) => {
      assertExtensionsEnabled();

      const result = await Extensions.storage.delete({ auth: context.auth, ...input.query });

      emitStorageEvent(context.auth, context.auth.extension!.extensionID, input.query.key, false);

      return result;
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
  setStorageEntry: authorizedHandlers.setStorageEntry.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.storage.set({ auth: context.auth, ...input });

    emitStorageEvent(context.auth, input.extensionID, input.key, true);

    return result;
  }),
  deleteStorageEntry: authorizedHandlers.deleteStorageEntry.handler(async ({ context, input }) => {
    assertExtensionsEnabled();

    const result = await Extensions.storage.delete({ auth: context.auth, ...input });

    emitStorageEvent(context.auth, input.extensionID, input.key, false);

    return result;
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
    trackEvent("extension_installed", context.auth, { name: input.name });

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
    trackEvent("extension_uninstalled", context.auth);

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
  // Without extensions there are no custom elements, e.g. for MCP clients on any instance.
  listElements: authorizedHandlers.listElements.handler(({ context }) => {
    if (!config.PUBLIC_EXTENSIONS_ENABLED) return [];

    return Extensions.listElements({ auth: context.auth });
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
