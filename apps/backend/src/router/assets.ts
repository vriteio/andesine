import { assetDeliveryVariants } from "#backend/lib/assets/files";
import { assetAnalysisStatusEnum, assetFileFormatEnum, assetStatusEnum } from "#backend/db";
import { config } from "#backend/lib/config";
import { publicID } from "#backend/lib/primitives";
import { consumeRateLimit } from "#backend/lib/security";
import { authenticatedRoute, base, sessionRoute } from "#backend/lib/transport";
import { Asset } from "#backend/services/assets";
import { ORPCError } from "@orpc/server";
import * as z from "zod";

const assetHeadersType = z.object({
  "Cache-Control": z.literal("private, no-store")
});

const assetSearchResultType = z.object({
  assetID: publicID("ast"),
  entryID: publicID("ent"),
  entryName: z.string(),
  filename: z.string(),
  description: z.string(),
  thumbnailURL: z.url(),
  width: z.number(),
  height: z.number()
});

const assetsRouter = base.prefix("/assets").router({
  search: authenticatedRoute
    .route({ method: "GET", path: "/search", outputStructure: "detailed" })
    .input(
      z.object({
        query: z.string().trim().max(500).default(""),
        checksum: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        semantic: z.boolean().default(true),
        limit: z.number().int().min(1).max(50).default(24)
      })
    )
    .output(
      z.object({
        headers: assetHeadersType,
        body: z.array(assetSearchResultType)
      })
    )
    .handler(async ({ input, context }) => ({
      headers: { "Cache-Control": "private, no-store" as const },
      body: await Asset.search({ ...input, auth: context.auth })
    })),
  getProfile: base
    .route({ method: "GET", path: "/profiles/:assetID", outputStructure: "detailed" })
    .input(z.object({ assetID: publicID("ast") }))
    .output(
      z.object({
        headers: z.object({
          "Cache-Control": z.literal("private, no-store"),
          "X-Content-Type-Options": z.literal("nosniff"),
          "Content-Disposition": z.literal("inline")
        }),
        body: z.file()
      })
    )
    .handler(async ({ input }) => ({
      headers: {
        "Cache-Control": "private, no-store" as const,
        "X-Content-Type-Options": "nosniff" as const,
        "Content-Disposition": "inline" as const
      },
      body: await Asset.Profile.get(input)
    })),
  uploadProfile: sessionRoute
    .route({ method: "POST", path: "/profiles/uploads", outputStructure: "detailed" })
    .input(
      z.object({
        target: z.enum(["workspace", "user"]),
        assetID: publicID("ast"),
        file: z.file().min(1).max(config.ASSET_MAX_UPLOAD_BYTES)
      })
    )
    .output(z.object({ headers: assetHeadersType, body: z.object({ assetID: publicID("ast") }) }))
    .handler(async ({ context, input }) => {
      const limit = await consumeRateLimit({
        scope: "profile-image-upload",
        key: context.auth.session!.userID,
        limit: { max: 10, window: 60 }
      });
      if (!limit.allowed)
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "Too many image uploads; try again shortly"
        });
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
  getProfileUpload: sessionRoute
    .route({ method: "GET", path: "/profiles/uploads/:assetID", outputStructure: "detailed" })
    .input(z.object({ assetID: publicID("ast"), target: z.enum(["workspace", "user"]) }))
    .output(
      z.object({
        headers: assetHeadersType,
        body: z.object({
          status: z.enum(assetStatusEnum.enumValues),
          failureReason: z.string().nullable()
        })
      })
    )
    .handler(async ({ input, context }) => ({
      headers: { "Cache-Control": "private, no-store" as const },
      body: await Asset.Profile.getUpload({ ...input, auth: context.auth })
    })),
  setProfile: sessionRoute
    .route({ method: "PUT", path: "/profiles", outputStructure: "detailed" })
    .input(z.object({ assetID: publicID("ast"), target: z.enum(["workspace", "user"]) }))
    .output(z.object({ status: z.literal(204), headers: assetHeadersType }))
    .handler(async ({ input, context }) => {
      await Asset.Profile.set({ ...input, auth: context.auth });
      return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
    }),
  removeProfile: sessionRoute
    .route({ method: "DELETE", path: "/profiles", outputStructure: "detailed" })
    .input(z.object({ target: z.enum(["workspace", "user"]) }))
    .output(z.object({ status: z.literal(204), headers: assetHeadersType }))
    .handler(async ({ input, context }) => {
      await Asset.Profile.remove({ ...input, auth: context.auth });
      return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
    }),
  importURL: authenticatedRoute
    .route({ method: "POST", path: "/imports", outputStructure: "detailed" })
    .input(
      z.object({
        assetID: publicID("ast"),
        entryID: publicID("ent"),
        url: z.url().max(4096),
        checkDuplicates: z.boolean().default(false)
      })
    )
    .output(
      z.object({
        headers: assetHeadersType,
        body: z.union([
          z.object({ assetID: publicID("ast") }),
          z.object({ duplicate: assetSearchResultType })
        ])
      })
    )
    .handler(async ({ context, input }) => ({
      headers: { "Cache-Control": "private, no-store" as const },
      body: await Asset.importURL({ ...input, auth: context.auth })
    })),
  attach: authenticatedRoute
    .route({ method: "POST", path: "/:assetID/attachments", outputStructure: "detailed" })
    .input(z.object({ assetID: publicID("ast"), entryID: publicID("ent") }))
    .output(z.object({ status: z.literal(204), headers: assetHeadersType }))
    .handler(async ({ context, input }) => {
      await Asset.attach({ ...input, auth: context.auth });
      return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
    }),
  register: authenticatedRoute
    .route({ method: "POST", path: "/uploads", outputStructure: "detailed" })
    .input(
      z.object({
        assetID: publicID("ast"),
        entryID: publicID("ent"),
        filename: z.string().trim().min(1).max(255),
        byteSize: z.number().int().min(1).max(config.ASSET_MAX_UPLOAD_BYTES),
        checksum: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .describe("SHA-256 of the file bytes, verified by the backend and worker")
      })
    )
    .output(
      z.object({
        headers: assetHeadersType,
        body: z.object({
          assetID: publicID("ast"),
          expiresAt: z.iso.datetime()
        })
      })
    )
    .handler(async ({ context, input }) => {
      const limit = await consumeRateLimit({
        scope: "asset-register",
        key: context.auth.workspaceID,
        limit: { max: 30, window: 60 }
      });
      if (!limit.allowed) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "Too many image uploads; try again shortly"
        });
      }
      return {
        headers: { "Cache-Control": "private, no-store" },
        body: await Asset.register({ ...input, auth: context.auth })
      } as const;
    }),
  upload: authenticatedRoute
    .route({ method: "PUT", path: "/:assetID/upload", outputStructure: "detailed" })
    .input(
      z.object({
        assetID: publicID("ast"),
        file: z.file().min(1).max(config.ASSET_MAX_UPLOAD_BYTES)
      })
    )
    .output(z.object({ status: z.literal(204), headers: assetHeadersType }))
    .handler(async ({ context, input }) => {
      await Asset.upload({
        assetID: input.assetID,
        auth: context.auth,
        body: Buffer.from(await input.file.arrayBuffer())
      });
      return { status: 204, headers: { "Cache-Control": "private, no-store" } } as const;
    }),
  get: authenticatedRoute
    .route({ method: "GET", path: "/:assetID", outputStructure: "detailed" })
    .input(z.object({ assetID: publicID("ast"), entryID: publicID("ent").optional() }))
    .output(
      z.object({
        headers: assetHeadersType,
        body: z.object({
          assetID: publicID("ast"),
          filename: z.string(),
          status: z.enum(assetStatusEnum.enumValues),
          failureReason: z.string().nullable(),
          analysis: z
            .object({
              status: z.enum(assetAnalysisStatusEnum.enumValues),
              description: z.string().nullable(),
              extractedText: z.string().nullable()
            })
            .nullable(),
          files: z.array(
            z.object({
              variant: z.enum(assetDeliveryVariants),
              format: z.enum(assetFileFormatEnum.enumValues),
              byteSize: z.number(),
              width: z.number(),
              height: z.number(),
              url: z.url(),
              expiresAt: z.iso.datetime()
            })
          )
        })
      })
    )
    .handler(async ({ context, input }) => {
      return {
        headers: { "Cache-Control": "private, no-store" },
        body: await Asset.get({ ...input, auth: context.auth })
      } as const;
    })
});

export { assetsRouter };
