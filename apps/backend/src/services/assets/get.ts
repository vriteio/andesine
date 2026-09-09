import { getDeliveryFiles, type assetDeliveryVariants } from "#backend/lib/assets/files";
import {
  assetAnalyses,
  assetFiles,
  assetUploads,
  assets,
  entries,
  entryAssets,
  entryVersionAssets
} from "#backend/db";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { withAuthorization } from "#backend/lib/policy";
import { toAssetID, toUUID } from "#backend/lib/primitives";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ORPCError } from "@orpc/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { loadAssetWorkspace, type AssetInput } from "#backend/lib/assets/access";

interface AssetDetails {
  assetID: string;
  filename: string;
  status: typeof assets.$inferSelect.status;
  failureReason: string | null;
  analysis: {
    status: typeof assetAnalyses.$inferSelect.status;
    description: string | null;
    extractedText: string | null;
  } | null;
  files: Array<{
    variant: (typeof assetDeliveryVariants)[number];
    format: typeof assetFiles.$inferSelect.format;
    width: number;
    height: number;
    byteSize: number;
    url: string;
    expiresAt: string;
  }>;
}

const getAsset = withAuthorization<AssetInput, undefined, AssetDetails>(
  { tree: true },
  async ({ database, authorization, workspaceID, input }) => {
    await loadAssetWorkspace(database, workspaceID);
    const assetID = toUUID(input.assetID);
    const sources = await database
      .selectDistinct({ id: entries.id, collectionID: entries.collectionID })
      .from(entries)
      .leftJoin(
        entryAssets,
        and(
          eq(entryAssets.entryID, entries.id),
          eq(entryAssets.assetID, assetID),
          or(isNull(entryAssets.pendingUntil), gt(entryAssets.pendingUntil, new Date()))
        )
      )
      .leftJoin(
        assetUploads,
        and(
          eq(assetUploads.entryID, entries.id),
          eq(assetUploads.assetID, assetID),
          gt(assetUploads.expiresAt, new Date())
        )
      )
      .where(
        and(
          input.entryID ? eq(entries.id, toUUID(input.entryID)) : undefined,
          eq(entries.workspaceID, workspaceID),
          isNull(entries.deletedAt),
          or(eq(entryAssets.assetID, assetID), eq(assetUploads.assetID, assetID))
        )
      );

    if (!authorization.filterEntryIDs(sources, "entry:read").length) {
      const historicalSources = await database
        .selectDistinct({ id: entries.id, collectionID: entries.collectionID })
        .from(entries)
        .innerJoin(entryVersionAssets, eq(entryVersionAssets.entryID, entries.id))
        .where(
          and(
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt),
            eq(entryVersionAssets.assetID, assetID),
            input.entryID ? eq(entries.id, toUUID(input.entryID)) : undefined
          )
        );

      if (!authorization.filterEntryIDs(historicalSources, "version:read").length) {
        throw new ORPCError("NOT_FOUND");
      }
    }

    const [asset] = await database
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetID), eq(assets.workspaceID, workspaceID)));

    if (!asset || asset.status === "deleting") throw new ORPCError("NOT_FOUND");

    const [upload] = await database
      .select({ failureReason: assetUploads.failureReason })
      .from(assetUploads)
      .where(eq(assetUploads.assetID, assetID));
    const [analysis] = await database
      .select({
        status: assetAnalyses.status,
        description: assetAnalyses.description,
        extractedText: assetAnalyses.extractedText
      })
      .from(assetAnalyses)
      .where(eq(assetAnalyses.assetID, assetID));
    const files =
      asset.status === "ready"
        ? await database.select().from(assetFiles).where(eq(assetFiles.assetID, assetID))
        : [];
    const storage = requireAssetStorage();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    return {
      assetID: toAssetID(assetID),
      filename: asset.filename,
      status: asset.status,
      failureReason: upload?.failureReason || null,
      analysis: analysis || null,
      files: await Promise.all(
        getDeliveryFiles(files).map(async (file) => ({
          variant: file.variant,
          format: file.format,
          byteSize: file.byteSize,
          width: file.width,
          height: file.height,
          expiresAt,
          url: await getSignedUrl(
            storage.client,
            new GetObjectCommand({
              Bucket: storage.bucket,
              Key: file.objectKey,
              ResponseContentType: `image/${file.format}`,
              ResponseCacheControl: "private, no-store",
              ResponseContentDisposition: "inline"
            }),
            { expiresIn: 60 }
          )
        }))
      )
    };
  }
);

export { getAsset };
export type { AssetDetails };
