import { MAX_SEARCH_RESULTS } from "#backend/lib/api/limits";
import { schemaMigrationErrors, assetErrors } from "./errors";
import { publicID } from "#backend/lib/primitives";
import * as z from "zod";
import { authenticatedContract, baseContract, sessionContract } from "./base";
import {
  assetDetailsType,
  assetHeadersType,
  assetSearchResultType,
  assetStatusType,
  assetUploadRegistrationType
} from "./schemas/assets";

const createAssetsContract = (maxUploadBytes: number) => {
  return baseContract.prefix("/assets").router({
    search: authenticatedContract
      .route({
        summary: "Search assets",
        description:
          "Finds workspace images by text or SHA-256 checksum. Semantic search defaults to true. Returns up to 50 results.",
        tags: ["assets"],
        method: "GET",
        path: "/search",
        outputStructure: "detailed"
      })
      .meta({ example: { query: "mountains", limit: 10 } })
      .meta({ required: { session: true, key: ["read:entries", "read:collections"] } })
      .input(
        z.object({
          query: z.string().trim().max(500).default(""),
          checksum: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
          semantic: z.boolean().default(true),
          limit: z.number().int().min(1).max(MAX_SEARCH_RESULTS).default(24)
        })
      )
      .output(
        z.object({
          headers: assetHeadersType,
          body: z.array(assetSearchResultType)
        })
      ),
    getProfile: baseContract
      .route({ method: "GET", path: "/profiles/{assetID}", outputStructure: "detailed" })
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
      ),
    uploadProfile: sessionContract
      .errors(assetErrors)
      .route({ method: "POST", path: "/profiles/uploads", outputStructure: "detailed" })
      .input(
        z.object({
          target: z.enum(["workspace", "user"]),
          assetID: publicID("ast"),
          file: z.file().min(1).max(maxUploadBytes)
        })
      )
      .output(
        z.object({ headers: assetHeadersType, body: z.object({ assetID: publicID("ast") }) })
      ),
    getProfileUpload: sessionContract
      .route({ method: "GET", path: "/profiles/uploads/{assetID}", outputStructure: "detailed" })
      .input(z.object({ assetID: publicID("ast"), target: z.enum(["workspace", "user"]) }))
      .output(
        z.object({
          headers: assetHeadersType,
          body: z.object({
            status: assetStatusType,
            failureReason: z.string().nullable()
          })
        })
      ),
    setProfile: sessionContract
      .route({ method: "PUT", path: "/profiles", outputStructure: "detailed" })
      .input(z.object({ assetID: publicID("ast"), target: z.enum(["workspace", "user"]) }))
      .output(z.object({ status: z.literal(204), headers: assetHeadersType })),
    removeProfile: sessionContract
      .route({ method: "DELETE", path: "/profiles", outputStructure: "detailed" })
      .input(z.object({ target: z.enum(["workspace", "user"]) }))
      .output(z.object({ status: z.literal(204), headers: assetHeadersType })),
    importURL: authenticatedContract
      .errors(assetErrors)
      .errors(schemaMigrationErrors)
      .route({
        summary: "Import an image URL",
        description:
          "Downloads a remote image and starts processing it for the entry. With checkDuplicates, can return an existing image instead. Use assets.get to check processing status.",
        tags: ["assets"],
        method: "POST",
        path: "/imports",
        outputStructure: "detailed"
      })
      .meta({
        example: {
          assetID: "ast_example",
          entryID: "ent_example",
          url: "https://example.com/image.png",
          checkDuplicates: true
        }
      })
      .meta({ required: { session: true, key: ["entries"] } })
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
      ),
    attach: authenticatedContract
      .errors(assetErrors)
      .errors(schemaMigrationErrors)
      .route({
        summary: "Attach an asset",
        description:
          "Attaches a ready image to an entry. This does not insert an image node into the document.",
        tags: ["assets"],
        method: "POST",
        path: "/{assetID}/attachments",
        outputStructure: "detailed"
      })
      .meta({ example: { assetID: "ast_example", entryID: "ent_example" } })
      .meta({ required: { session: true, key: ["entries"] } })
      .input(z.object({ assetID: publicID("ast"), entryID: publicID("ent") }))
      .output(z.object({ status: z.literal(204), headers: assetHeadersType })),
    register: authenticatedContract
      .errors(assetErrors)
      .errors(schemaMigrationErrors)
      .route({
        summary: "Register an image upload",
        description:
          "Reserves an image upload for an entry. Supply the byte count and lowercase SHA-256 checksum of the file. Call assets.upload before expiresAt, then use assets.get to check processing status.",
        tags: ["assets"],
        method: "POST",
        path: "/uploads",
        outputStructure: "detailed"
      })
      .meta({
        example: {
          assetID: "ast_example",
          entryID: "ent_example",
          filename: "image.png",
          byteSize: 1024,
          checksum: "0000000000000000000000000000000000000000000000000000000000000000"
        }
      })
      .meta({ required: { session: true, key: ["entries"] } })
      .input(
        z.object({
          assetID: publicID("ast"),
          entryID: publicID("ent"),
          filename: z.string().trim().min(1).max(255),
          byteSize: z.number().int().min(1).max(maxUploadBytes),
          checksum: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .describe("SHA-256 of the file bytes, verified by the backend and worker")
        })
      )
      .output(
        z.object({
          headers: assetHeadersType,
          body: assetUploadRegistrationType
        })
      ),
    upload: authenticatedContract
      .errors(assetErrors)
      .errors(schemaMigrationErrors)
      .route({
        summary: "Upload registered image bytes",
        description:
          "Uploads a file for a registered asset with multipart/form-data. The bytes must match the registered size and checksum. Processing continues after the upload; use assets.get to check status.",
        tags: ["assets"],
        method: "PUT",
        path: "/{assetID}/upload",
        outputStructure: "detailed"
      })
      .meta({ example: { assetID: "ast_example", file: "<binary file>" } })
      .meta({ required: { session: true, key: ["entries"] } })
      .input(
        z.object({
          assetID: publicID("ast"),
          file: z.file().min(1).max(maxUploadBytes)
        })
      )
      .output(z.object({ status: z.literal(204), headers: assetHeadersType })),
    get: authenticatedContract
      .route({
        summary: "Get asset status and details",
        description:
          "Returns image metadata, processing status, and available files. Supply entryID when checking access through an entry.",
        tags: ["assets"],
        method: "GET",
        path: "/{assetID}",
        outputStructure: "detailed"
      })
      .meta({ example: { assetID: "ast_example", entryID: "ent_example" } })
      .meta({ required: { session: true, key: true } })
      .input(z.object({ assetID: publicID("ast"), entryID: publicID("ent").optional() }))
      .output(
        z.object({
          headers: assetHeadersType,
          body: assetDetailsType
        })
      )
  });
};

export { createAssetsContract };
