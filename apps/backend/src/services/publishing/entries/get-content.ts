import { getDeliveryFiles, type assetDeliveryVariants } from "#backend/lib/assets/files";
import { assetFiles, entryVersionAssets } from "#backend/db";
import { config } from "#backend/lib/config";
import { toAssetID, toUUID, toWorkspaceID } from "#backend/lib/primitives";
import { and, eq } from "drizzle-orm";
import { getContentBlocks, type ContentBlocks, type ContentNode } from "#backend/lib/content";
import type { VersionSummary } from "#backend/lib/data";
import { normalizePublishingChannelCode } from "#backend/lib/publishing";
import { withPublicWorkspace } from "#backend/lib/policy";
import { getPublicPublishedEntryVersion } from "./get-version";

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
  fragments: ContentBlocks["fragments"];
  name: string;
  properties: ContentBlocks["properties"];
  version: VersionSummary;
}

interface PublishedEntryContentInput {
  entryID: string;
  channel: string;
}

const getPublishedEntryContent = withPublicWorkspace<
  PublishedEntryContentInput,
  PublishedEntryContent
>({}, async ({ database, input, workspaceID }) => {
  const channel = normalizePublishingChannelCode(input.channel);
  const { document, ...version } = await getPublicPublishedEntryVersion({
    ...input,
    channel,
    workspaceID
  });
  const { fragments, properties } = getContentBlocks(document);

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
    channel,
    assets: getDeliveryFiles(files).map((file) => ({
      ...file,
      assetID: toAssetID(file.assetID),
      url: `${config.PUBLIC_API_URL}/content/assets/${toWorkspaceID(workspaceID)}/${toAssetID(file.assetID)}/${file.variant}`
    })),
    content: document,
    fragments,
    name: version.entryName,
    properties,
    version
  };
});

export { getPublishedEntryContent };
export type { PublishedEntryContent };
