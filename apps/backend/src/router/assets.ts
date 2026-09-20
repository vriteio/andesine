import { consumeRateLimit } from "#backend/lib/security";
import { authorized } from "#backend/lib/transport/middleware/authorized";
import { Asset } from "#backend/services/assets";
import { ORPCError } from "@orpc/server";
import { api } from "./implement";

const handlers = api.assets;
const authorizedHandlers = handlers.use(authorized);
const assetsRouter = handlers.router({
  search: authorizedHandlers.search.handler(async ({ input, context }) => ({
    headers: { "Cache-Control": "private, no-store" as const },
    body: await Asset.search({ ...input, auth: context.auth })
  })),
  getProfile: handlers.getProfile.handler(async ({ input }) => ({
    headers: {
      "Cache-Control": "private, no-store" as const,
      "X-Content-Type-Options": "nosniff" as const,
      "Content-Disposition": "inline" as const
    },
    body: await Asset.Profile.get(input)
  })),
  uploadProfile: authorizedHandlers.uploadProfile.handler(async ({ context, input }) => {
    const limit = await consumeRateLimit({
      scope: "profile-image-upload",
      key: context.auth.session!.userID,
      limit: { max: 10, window: 60 }
    });
    if (!limit.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many image uploads; try again shortly",
        data: {
          retryAfterSeconds: limit.retryAfter,
          hints: ["Wait at least retryAfterSeconds before starting another upload."]
        }
      });
    }
    return {
      headers: { "Cache-Control": "private, no-store" as const },
      body: await Asset.Profile.upload({
        target: input.target,
        assetID: input.assetID,
        filename: input.file.name,
        body: Buffer.from(await input.file.arrayBuffer()),
        auth: context.auth
      })
    };
  }),
  getProfileUpload: authorizedHandlers.getProfileUpload.handler(async ({ input, context }) => ({
    headers: { "Cache-Control": "private, no-store" as const },
    body: await Asset.Profile.getUpload({ ...input, auth: context.auth })
  })),
  setProfile: authorizedHandlers.setProfile.handler(async ({ input, context }) => {
    await Asset.Profile.set({ ...input, auth: context.auth });
    return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
  }),
  removeProfile: authorizedHandlers.removeProfile.handler(async ({ input, context }) => {
    await Asset.Profile.remove({ ...input, auth: context.auth });
    return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
  }),
  importURL: authorizedHandlers.importURL.handler(async ({ context, input }) => ({
    headers: { "Cache-Control": "private, no-store" as const },
    body: await Asset.importURL({ ...input, auth: context.auth })
  })),
  attach: authorizedHandlers.attach.handler(async ({ context, input }) => {
    await Asset.attach({ ...input, auth: context.auth });
    return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
  }),
  register: authorizedHandlers.register.handler(async ({ context, input }) => {
    const limit = await consumeRateLimit({
      scope: "asset-register",
      key: context.auth.workspaceID,
      limit: { max: 30, window: 60 }
    });
    if (!limit.allowed) {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many image uploads; try again shortly",
        data: {
          retryAfterSeconds: limit.retryAfter,
          hints: ["Wait at least retryAfterSeconds before starting another upload."]
        }
      });
    }
    return {
      headers: { "Cache-Control": "private, no-store" },
      body: await Asset.register({ ...input, auth: context.auth })
    } as const;
  }),
  upload: authorizedHandlers.upload.handler(async ({ context, input }) => {
    await Asset.upload({
      assetID: input.assetID,
      auth: context.auth,
      body: Buffer.from(await input.file.arrayBuffer())
    });
    return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
  }),
  get: authorizedHandlers.get.handler(async ({ context, input }) => {
    return {
      headers: { "Cache-Control": "private, no-store" },
      body: await Asset.get({ ...input, auth: context.auth })
    } as const;
  })
});

export { assetsRouter };
