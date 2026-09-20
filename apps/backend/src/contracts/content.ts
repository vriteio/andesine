import { propertyFilterType } from "./schemas/search";
import {
  collectionSelectorShape,
  publishedEntrySelectorShape,
  hasCollectionSelector,
  hasOptionalCollectionSelector,
  hasPublishedEntrySelector
} from "./schemas/paths";
import { schemaRevisionType, schemaHashType } from "#backend/lib/schema/contract/recorded";
import { contentDeliveryErrors, contentReadErrors } from "./errors";
import { pageInputType } from "./schemas/pagination";
import { publishedEntryListType, publishedCollectionListType } from "./schemas/content";
import { assetDeliveryVariants } from "#backend/lib/assets/files";
import { id, publicID } from "#backend/lib/primitives";
import { publishingChannelCodeType } from "#backend/lib/publishing/channel";
import { PUBLISHED_CHANNEL_CODE } from "#backend/lib/publishing/config";
import * as z from "zod";
import { baseContract } from "./base";
import { cachedPublishedContentType, cachedPublishedTreeType } from "./schemas/content";

interface PublishingSnapshotSelector {
  channel?: string;
  snapshotID?: string;
}

const hasValidSnapshotSelector = (input: PublishingSnapshotSelector): boolean => {
  return !input.channel || !input.snapshotID;
};
const publishedListInputType = pageInputType
  .extend({
    ...collectionSelectorShape,
    channel: publishingChannelCodeType.optional(),
    snapshotID: publicID("snp").optional()
  })
  .refine(hasOptionalCollectionSelector, {
    message: "Use collectionID or collectionPath, not both"
  })
  .refine(hasValidSnapshotSelector, { message: "Use channel or snapshotID, not both" })
  .refine((input) => !input.cursor || Boolean(input.snapshotID), {
    message: "Use the previous page snapshotID when passing cursor"
  });
const contentContract = baseContract.prefix("/content").router({
  listCollections: baseContract
    .route({
      method: "GET",
      path: "/collections",
      summary: "List published collections",
      description:
        "Returns a flat page of collections from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Optionally select direct children using collectionID or collectionPath. Results are ordered by ID, not display order.",
      tags: ["content"]
    })
    .meta({ required: { key: ["read:publishing"] }, example: { channel: "published", limit: 20 } })
    .input(publishedListInputType)
    .output(publishedCollectionListType),
  listEntries: baseContract
    .errors(contentDeliveryErrors)
    .route({
      method: "GET",
      path: "/entries",
      summary: "List published entries",
      description:
        "Returns a flat page of entries from a publication snapshot. The default channel is published. On later pages, pass the returned snapshotID and pagination.nextCursor, and omit channel. Select direct children using collectionID or collectionPath, or include nested entries with descendants: true. descendants requires a collection scope. All property filters must match the assigned version. includeContent: true returns validated full content, properties, fragments, assets, and recorded schema metadata. An invalid full item fails the page. Keep the same scope and filters across pages. Results are ordered by ID, not display order.",
      tags: ["content"]
    })
    .meta({ required: { key: ["read:publishing"] }, example: { channel: "published", limit: 20 } })
    .input(
      publishedListInputType
        .safeExtend({
          descendants: z.boolean().default(false),
          includeContent: z.boolean().default(false),
          filters: z.array(propertyFilterType).max(20).default([])
        })
        .refine(
          (input) => {
            return (
              !input.descendants ||
              input.collectionID !== undefined ||
              input.collectionPath !== undefined
            );
          },
          {
            message: "descendants requires collectionID or collectionPath"
          }
        )
    )
    .output(publishedEntryListType),
  getSchema: baseContract
    .errors(contentDeliveryErrors)
    .route({
      method: "GET",
      path: "/entries/schema",
      summary: "Get a published entry schema",
      description:
        "Returns the exact recorded effective schema, or null for schema-less content. Uses the same publication access as content.get. Pass its snapshotID for a consistent read; use channel or snapshotID, not both.",
      tags: ["content"]
    })
    .meta({
      required: { key: ["read:publishing"] },
      example: { entryID: "ent_example", channel: "published" }
    })
    .input(
      z
        .object({
          ...publishedEntrySelectorShape,
          channel: publishingChannelCodeType.optional(),
          snapshotID: publicID("snp").optional()
        })
        .refine(hasPublishedEntrySelector, { message: "Use exactly one ID or path selector" })
        .refine(hasValidSnapshotSelector, { message: "Use channel or snapshotID, not both" })
    )
    .output(schemaRevisionType.nullable()),
  getAsset: baseContract
    .route({
      summary: "Download a published asset",
      description:
        "Returns binary image data from a publication snapshot. No API key is required. The asset must belong to the entry in that available snapshot. Use the asset URLs returned with published content.",
      tags: ["content"],
      method: "GET",
      path: "/assets/{workspaceID}/{snapshotID}/{entryID}/{assetID}/{variant}",
      outputStructure: "detailed"
    })
    .meta({
      example: {
        workspaceID: "ws_example",
        snapshotID: "snp_example",
        entryID: "ent_example",
        assetID: "ast_example",
        variant: "display"
      }
    })
    .input(
      z.object({
        workspaceID: publicID("ws"),
        snapshotID: publicID("snp"),
        entryID: id(),
        assetID: publicID("ast"),
        variant: z.enum(assetDeliveryVariants)
      })
    )
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
  get: baseContract
    .errors(contentReadErrors)
    .route({
      summary: "Get published entry content",
      description:
        "Returns content from a publishing channel or a specific available snapshot. Use channel or snapshotID, never both. The default channel is published. Validates saved content against its recorded schema and returns schema metadata. expectedSchemaHash must match that revision; schema-less content cannot match it. Validation and hash checks run before ETag handling. Supports ETag and If-None-Match; a match returns 304 without a body.",
      tags: ["content"],
      method: "GET",
      path: "/entries/get",
      outputStructure: "detailed"
    })
    .meta({ example: { entryID: "ent_example", channel: "published" } })
    .meta({
      required: {
        key: ["read:publishing"]
      }
    })
    .input(
      z
        .object({
          ...publishedEntrySelectorShape,
          expectedSchemaHash: schemaHashType.optional(),
          channel: publishingChannelCodeType
            .optional()
            .describe(`Publishing channel, defaults to ${PUBLISHED_CHANNEL_CODE}`),
          snapshotID: publicID("snp").optional().describe("Historical publication snapshot to read")
        })
        .refine(hasPublishedEntrySelector, { message: "Use exactly one ID or path selector" })
        .refine(hasValidSnapshotSelector, {
          message: "Use either channel or snapshotID, not both",
          path: ["snapshotID"]
        })
    )
    .output(cachedPublishedContentType),
  getTree: baseContract
    .route({
      summary: "Get a published collection tree",
      description:
        "Returns a published collection tree and its snapshot ID. Use channel or snapshotID, never both. The default channel is published. Reuse the snapshot ID for consistent content reads. Supports ETag and If-None-Match; a match returns 304 without a body.",
      tags: ["content"],
      method: "GET",
      path: "/tree",
      outputStructure: "detailed"
    })
    .meta({ example: { collectionID: "coll_example", channel: "published" } })
    .meta({
      required: {
        key: ["read:publishing"]
      }
    })
    .input(
      z
        .object({
          ...collectionSelectorShape,
          channel: publishingChannelCodeType
            .optional()
            .describe(`Publishing channel, defaults to ${PUBLISHED_CHANNEL_CODE}`),
          snapshotID: publicID("snp").optional().describe("Historical publication snapshot to read")
        })
        .refine(hasCollectionSelector, { message: "Use exactly one ID or path selector" })
        .refine(hasValidSnapshotSelector, {
          message: "Use either channel or snapshotID, not both",
          path: ["snapshotID"]
        })
    )
    .output(cachedPublishedTreeType)
});

export { contentContract };
