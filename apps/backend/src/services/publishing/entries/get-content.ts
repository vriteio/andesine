import { getDeliveryFiles, type assetDeliveryVariants } from "#backend/lib/assets/files";
import { assetFiles, entryVersionAssets } from "#backend/db";
import { config } from "#backend/lib/config";
import { toAssetID, toEntryID, toSnapshotID, toUUID, toWorkspaceID } from "#backend/lib/primitives";
import { and, eq } from "drizzle-orm";
import { getContentBlocks, type ContentBlocks, type ContentNode } from "#backend/lib/content";
import type { VersionSummary } from "#backend/lib/data";
import { withPublicWorkspace } from "#backend/lib/policy";
import { loadPublishedEntryVersion } from "./get-version";

interface PublishedEntryContent {
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

interface PublishedEntryContentInput {
  entryID: string;
  channel?: string;
  snapshotID?: string;
}

const getPublishedEntryContent = withPublicWorkspace<
  PublishedEntryContentInput,
  PublishedEntryContent
>({ transaction: "atomic" }, async ({ database, input, workspaceID }) => {
  const source = await loadPublishedEntryVersion(database, workspaceID, input);
  const { document, ...version } = source.version;
  const { fragments, properties } = getContentBlocks(document);
  const entryID = toEntryID(toUUID(input.entryID));
  const snapshotID = toSnapshotID(source.snapshot.id);

  const files = await database
    .select({
      assetID: assetFiles.assetID,
      variant: assetFiles.variant,
      format: assetFiles.format,
      width: assetFiles.width,
      height: assetFiles.height,
      byteSize: assetFiles.byteSize
    })
    .from(entryVersionAssets)
    .innerJoin(assetFiles, eq(assetFiles.assetID, entryVersionAssets.assetID))
    .where(
      and(
        eq(entryVersionAssets.workspaceID, workspaceID),
        eq(entryVersionAssets.versionID, toUUID(version.id))
      )
    )
    .orderBy(assetFiles.assetID, assetFiles.variant);

  return {
    channel: source.snapshot.channelCode,
    assets: getDeliveryFiles(files).map((file) => ({
      ...file,
      assetID: toAssetID(file.assetID),
      url: `${config.PUBLIC_API_URL}/content/assets/${toWorkspaceID(workspaceID)}/${snapshotID}/${entryID}/${toAssetID(file.assetID)}/${file.variant}`
    })),
    content: document,
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
