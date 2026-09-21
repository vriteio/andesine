import { publicID } from "#backend/lib/primitives";
import { schemaHashType, schemaRevisionType } from "#backend/lib/schema/contract/recorded";
import { publishingChannelCodeType } from "#backend/lib/publishing/channel";
import { contentPathType } from "./paths";
import * as z from "zod";

const typeMetadataInputType = z.object({
  collections: z
    .array(z.union([publicID("coll"), contentPathType]))
    .max(100)
    .default([])
    .describe(
      "Collection IDs or paths. Includes selected subtrees; empty selects all accessible collections."
    ),
  includeEntries: z
    .boolean()
    .default(false)
    .describe("Include entry IDs, names, paths, and schema associations."),
  includeTree: z
    .boolean()
    .default(false)
    .describe("Include ordered child IDs for each collection. Also includes entry metadata.")
});
const publishedTypeMetadataInputType = typeMetadataInputType
  .extend({
    channel: publishingChannelCodeType.optional(),
    snapshotID: publicID("snp").optional()
  })
  .refine((input) => input.channel === undefined || input.snapshotID === undefined, {
    message: "Use channel or snapshotID, not both"
  });
const typeMetadataCollectionType = z.object({
  id: publicID("coll").nullable().describe("Null identifies the virtual root at /."),
  parentID: publicID("coll").nullable(),
  name: z.string(),
  path: z.string(),
  schemaRevisionIDs: z
    .array(publicID("schr").nullable())
    .describe(
      "Effective schema revisions for this collection. Null represents schema-free content. An empty array has no recorded schema evidence; use a general type without a warning."
    )
});
const typeMetadataEntryType = z.object({
  id: publicID("ent"),
  collectionID: publicID("coll").nullable(),
  name: z.string(),
  path: z.string(),
  schemaRevisionID: publicID("schr").nullable()
});
const typeMetadataTreeType = z.object({
  collectionID: publicID("coll").nullable(),
  collectionIDs: z.array(publicID("coll")).describe("Selected direct children in display order."),
  entryIDs: z.array(publicID("ent")).describe("Direct entries in display order.")
});
const typeMetadataType = z.object({
  formatVersion: z.literal(1),
  workspaceID: publicID("ws"),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("current") }),
    z.object({
      kind: z.literal("published"),
      channel: publishingChannelCodeType,
      snapshotID: publicID("snp"),
      expiresAt: z.date().nullable()
    })
  ]),
  fingerprint: schemaHashType.describe(
    "Deterministic hash of returned type metadata and source kind. Excludes publication snapshot IDs, expiry, content bodies, and unrequested entry/tree data."
  ),
  collections: z.array(typeMetadataCollectionType),
  revisions: z
    .array(schemaRevisionType)
    .describe(
      "Distinct effective definitions, including inherited fields, referenced by collections or entries."
    ),
  entries: z.array(typeMetadataEntryType).optional(),
  tree: z.array(typeMetadataTreeType).optional()
});

type TypeMetadataInput = z.infer<typeof typeMetadataInputType>;
type PublishedTypeMetadataInput = z.infer<typeof publishedTypeMetadataInputType>;
type TypeMetadata = z.infer<typeof typeMetadataType>;

export {
  typeMetadataInputType,
  publishedTypeMetadataInputType,
  typeMetadataType,
  typeMetadataCollectionType,
  typeMetadataEntryType,
  typeMetadataTreeType
};
export type { TypeMetadataInput, PublishedTypeMetadataInput, TypeMetadata };
