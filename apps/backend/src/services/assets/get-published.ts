import { ASSET_THUMBNAIL_SIZE } from "#backend/lib/assets/storage";
import type { assetDeliveryVariants } from "#backend/lib/assets/files";
import {
  assetFiles,
  assets,
  entryVersionAssets,
  publishingSnapshotEntries,
  workspaces
} from "#backend/db";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { resolvePublishingSnapshot } from "#backend/lib/publishing";
import { withPublicWorkspace } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, lte, or, desc } from "drizzle-orm";

interface GetPublishedAssetInput {
  assetID: string;
  entryID: string;
  snapshotID: string;
  variant: (typeof assetDeliveryVariants)[number];
}

// Publication is the access grant. Asset ownership alone never grants public access.
const getPublishedAsset = withPublicWorkspace<GetPublishedAssetInput, File>(
  { transaction: "atomic" },
  async ({ database, workspaceID, input }) => {
    const snapshot = await resolvePublishingSnapshot(database, workspaceID, {
      snapshotID: input.snapshotID
    });
    const [file] = await database
      .select({ file: assetFiles })
      .from(assetFiles)
      .innerJoin(assets, and(eq(assets.id, assetFiles.assetID), eq(assets.status, "ready")))
      .innerJoin(
        workspaces,
        and(eq(workspaces.id, assets.workspaceID), isNull(workspaces.deletingAt))
      )
      .innerJoin(entryVersionAssets, eq(entryVersionAssets.assetID, assets.id))
      .innerJoin(
        publishingSnapshotEntries,
        and(
          eq(publishingSnapshotEntries.snapshotID, snapshot.id),
          eq(publishingSnapshotEntries.entryID, toUUID(input.entryID)),
          eq(publishingSnapshotEntries.versionID, entryVersionAssets.versionID),
          eq(publishingSnapshotEntries.workspaceID, workspaceID)
        )
      )
      .where(
        and(
          eq(assets.workspaceID, workspaceID),
          eq(entryVersionAssets.workspaceID, workspaceID),
          eq(assets.id, toUUID(input.assetID)),
          or(
            eq(assetFiles.variant, input.variant),
            input.variant === "thumbnail"
              ? and(
                  eq(assetFiles.variant, "display"),
                  lte(assetFiles.width, ASSET_THUMBNAIL_SIZE),
                  lte(assetFiles.height, ASSET_THUMBNAIL_SIZE)
                )
              : undefined
          )
        )
      )
      .orderBy(desc(eq(assetFiles.variant, input.variant)))
      .limit(1);

    if (!file) throw new ORPCError("NOT_FOUND");

    const storage = requireAssetStorage();
    const bytes = await storage.read(file.file.objectKey, file.file.byteSize);

    return new File([new Uint8Array(bytes)], `${input.assetID}.${file.file.format}`, {
      type: `image/${file.file.format}`
    });
  }
);

export { getPublishedAsset };
