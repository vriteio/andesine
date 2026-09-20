import { contentSchemaMetadataType } from "#backend/lib/schema/contract/recorded";
import { paginationType } from "./pagination";
import { contentNodeType } from "#backend/lib/content/validation";
import { versionSummaryType } from "#backend/lib/data/entry-version";
import { id, publicID } from "#backend/lib/primitives";
import { publishingChannelCodeType } from "#backend/lib/publishing/channel";
import * as z from "zod";
import { assetFileFormatType, assetVariantType } from "./assets";
import { entryFragmentType, entryPropertyType } from "./entries";

interface PublishedTreeEntryOutput {
  path: string;
  id: string;
  name: string;
  version: {
    id: string;
    hash: string;
  };
}
interface PublishedTreeCollectionOutput {
  path: string;
  id: string | null;
  name: string;
  entries: PublishedTreeEntryOutput[];
  collections: PublishedTreeCollectionOutput[];
}

const publishedAssetType = z.object({
  assetID: publicID("ast"),
  variant: assetVariantType,
  format: assetFileFormatType,
  width: z.number(),
  height: z.number(),
  byteSize: z.number(),
  url: z.url()
});
const publishedContentType = z.object({
  id: publicID("ent"),
  path: z.string(),
  collectionID: publicID("coll").nullable(),
  schema: contentSchemaMetadataType.nullable(),
  channel: publishingChannelCodeType.describe("Publishing channel used for delivery"),
  snapshotID: publicID("snp").describe("Publication snapshot used for delivery"),
  expiresAt: z.date().nullable().describe("Expiry time for a retained historical snapshot"),
  name: z.string().describe("Entry name stored in the published version"),
  version: versionSummaryType,
  assets: z.array(publishedAssetType),
  content: contentNodeType,
  fragments: z.record(z.string(), entryFragmentType),
  properties: z.record(z.string(), entryPropertyType)
});
const publishedTreeVersionType = z.object({
  id: id().describe("ID of the assigned version"),
  hash: z.string().length(64).describe("Hash of the assigned version content")
});
const publishedTreeEntryType = z.object({
  path: z.string(),
  id: id().describe("ID of the published entry"),
  name: z.string().describe("Entry name stored in the published version"),
  version: publishedTreeVersionType
});
const publishedTreeCollectionType: z.ZodType<PublishedTreeCollectionOutput> = z.lazy(() => {
  return z.object({
    id: id().nullable().describe("Collection ID, or null for the virtual root"),
    path: z.string(),
    name: z.string().describe("Name of the collection"),
    entries: z.array(publishedTreeEntryType),
    collections: z.array(publishedTreeCollectionType)
  });
});
const publishedEntrySummaryType = publishedTreeEntryType.extend({
  collectionID: publicID("coll").nullable()
});
const publishedCollectionSummaryType = z.object({
  path: z.string(),
  id: publicID("coll"),
  parentID: publicID("coll").nullable(),
  name: z.string()
});
const publishedPageType = z.object({
  channel: publishingChannelCodeType,
  snapshotID: publicID("snp"),
  expiresAt: z.date().nullable(),
  pagination: paginationType
});
const publishedEntryContentType = publishedContentType.omit({
  channel: true,
  snapshotID: true,
  expiresAt: true
});
const publishedEntryListType = publishedPageType.extend({
  data: z.union([z.array(publishedEntryContentType), z.array(publishedEntrySummaryType)])
});
const publishedCollectionListType = publishedPageType.extend({
  data: z.array(publishedCollectionSummaryType)
});
const cacheHeadersType = z.object({
  "Cache-Control": z.string(),
  "ETag": z.string()
});
const cachedPublishedContentType = z.union([
  z.object({
    status: z.literal(200),
    headers: cacheHeadersType,
    body: publishedContentType
  }),
  z.object({
    status: z.literal(304).describe("Not Modified"),
    headers: cacheHeadersType
  })
]);
const publishedTreeType = z.object({
  channel: publishingChannelCodeType,
  snapshotID: publicID("snp").describe("Publication snapshot used for delivery"),
  expiresAt: z.date().nullable().describe("Expiry time for a retained historical snapshot"),
  collection: publishedTreeCollectionType
});
const cachedPublishedTreeType = z.union([
  z.object({
    status: z.literal(200),
    headers: cacheHeadersType,
    body: publishedTreeType
  }),
  z.object({
    status: z.literal(304).describe("Not Modified"),
    headers: cacheHeadersType
  })
]);

export {
  publishedEntryContentType,
  publishedEntrySummaryType,
  publishedCollectionSummaryType,
  publishedEntryListType,
  publishedCollectionListType,
  publishedAssetType,
  publishedContentType,
  publishedTreeVersionType,
  publishedTreeEntryType,
  publishedTreeCollectionType,
  cacheHeadersType,
  cachedPublishedContentType,
  publishedTreeType,
  cachedPublishedTreeType
};
