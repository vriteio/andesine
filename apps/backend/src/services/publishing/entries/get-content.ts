import { type assetFiles } from "@andesine/server/database";
import { getContentBlocks, type ContentBlocks, type ContentNode } from "@andesine/document";
import { loadPublishedAssets } from "#backend/lib/publishing/content-assets";
import { type PublishedEntrySelector } from "@andesine/contracts/content";
import { type assetDeliveryVariants } from "@andesine/contracts/assets";
import { toCollectionID, toEntryID, toSnapshotID } from "@andesine/contracts/primitives";
import { type VersionSummary } from "@andesine/contracts/versions";
import { withPublicWorkspace } from "#backend/lib/policy";
import { loadPublishedContentPaths } from "@andesine/server/content";
import { assertInCollectionScope, resolveCollectionScope } from "#backend/lib/publishing";
import { loadPublishedEntryVersion } from "#backend/lib/publishing/entry-version";
import { getVersionDetails } from "#backend/lib/versioning/details";
import {
  encodeEntryMDX,
  loadPublishedEntryPaths,
  resolvePublishedLinks
} from "#backend/lib/content";
import { createImageURLResolver } from "@andesine/converters";
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
  mdx?: string;
  expiresAt: Date | null;
  fragments: ContentBlocks["fragments"];
  name: string;
  properties: ContentBlocks["properties"];
  snapshotID: string;
  version: VersionSummary;
}

interface PublishedEntryContentInput extends PublishedEntrySelector {
  /** The collections that a publishable key can read. */
  collectionScope?: string[];
  expectedSchemaHash?: string;
  channel?: string;
  snapshotID?: string;
  format?: "json" | "mdx";
}

const getPublishedEntryContent = withPublicWorkspace<
  PublishedEntryContentInput,
  PublishedEntryContent
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const source = await loadPublishedEntryVersion(database, workspaceID, input);

  if (input.collectionScope) {
    const paths = await loadPublishedContentPaths(database, workspaceID, source.snapshot.id);

    assertInCollectionScope(
      resolveCollectionScope(paths, input.collectionScope),
      source.collectionID
    );
  }

  const {
    document: versionDocument,
    schema,
    ...version
  } = await getVersionDetails(
    database,
    source.version,
    source.contributorIDs,
    input.expectedSchemaHash
  );
  const document = resolvePublishedLinks(
    versionDocument,
    await loadPublishedEntryPaths(database, workspaceID, source.snapshot.id)
  );
  const { fragments, properties } = getContentBlocks(document);
  const entryID = toEntryID(source.version.entryID);
  const snapshotID = toSnapshotID(source.snapshot.id);

  const assets = await loadPublishedAssets(database, workspaceID, source.snapshot.id, [
    source.version
  ]);
  const versionAssets = assets.get(source.version.id) || [];

  return {
    id: entryID,
    path: source.path,
    slugPath: source.slugPath,
    collectionID: source.collectionID ? toCollectionID(source.collectionID) : null,
    channel: source.snapshot.channelCode,
    assets: versionAssets,
    content: document,
    ...(input.format === "mdx" && {
      mdx: await encodeEntryMDX(document, { imageURL: createImageURLResolver(versionAssets) })
    }),
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
