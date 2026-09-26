import { type assetFiles } from "@andesine/server/database";
import { getContentBlocks, type ContentBlocks, type ContentNode } from "@andesine/document";
import { loadPublishedAssets } from "#backend/lib/publishing/content-assets";
import { type PublishedEntrySelector } from "@andesine/contracts/content";
import { type assetDeliveryVariants } from "@andesine/contracts/assets";
import { toCollectionID, toEntryID, toSnapshotID } from "@andesine/contracts/primitives";
import { type VersionSummary } from "@andesine/contracts/versions";
import { withPublicWorkspace } from "#backend/lib/policy";
import { loadPublishedEntryVersion } from "#backend/lib/publishing/entry-version";
import { getVersionDetails } from "#backend/lib/versioning/details";
import { type ContentSchemaMetadata } from "@andesine/contracts/schema";

interface PublishedEntryContent {
  id: string;
  path: string;
  slugPath: string;
  collectionID: string | null;
  schema: ContentSchemaMetadata | null;
  channel: string;
  assets: Array<{
    assetID: string;
    variant: (typeof assetDeliveryVariants)[number];
    format: typeof assetFiles.$inferSelect.format;
    width: number;
    height: number;
    byteSize: number;
    url: string;
  }>;
  content: ContentNode;
  expiresAt: Date | null;
  fragments: ContentBlocks["fragments"];
  name: string;
  properties: ContentBlocks["properties"];
  snapshotID: string;
  version: VersionSummary;
}

interface PublishedEntryContentInput extends PublishedEntrySelector {
  expectedSchemaHash?: string;
  channel?: string;
  snapshotID?: string;
}

const getPublishedEntryContent = withPublicWorkspace<
  PublishedEntryContentInput,
  PublishedEntryContent
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const source = await loadPublishedEntryVersion(database, workspaceID, input);
  const { document, schema, ...version } = await getVersionDetails(
    database,
    source.version,
    source.contributorIDs,
    input.expectedSchemaHash
  );
  const { fragments, properties } = getContentBlocks(document);
  const entryID = toEntryID(source.version.entryID);
  const snapshotID = toSnapshotID(source.snapshot.id);

  const assets = await loadPublishedAssets(database, workspaceID, source.snapshot.id, [
    source.version
  ]);

  return {
    id: entryID,
    path: source.path,
    slugPath: source.slugPath,
    collectionID: source.collectionID ? toCollectionID(source.collectionID) : null,
    channel: source.snapshot.channelCode,
    assets: assets.get(source.version.id) || [],
    content: document,
    schema,
    expiresAt: source.snapshot.expiresAt,
    fragments,
    name: version.entryName,
    properties,
    snapshotID,
    version
  };
});

export { getPublishedEntryContent };
export type { PublishedEntryContent };
