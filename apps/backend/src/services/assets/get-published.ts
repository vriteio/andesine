import { ASSET_THUMBNAIL_SIZE } from "#backend/lib/assets/storage";
import type { assetDeliveryVariants } from "#backend/lib/assets/files";
import {
  assetFiles,
  assets,
  entries,
  entryPublications,
  entryVersionAssets,
  workspaces
} from "#backend/db";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { withPublicWorkspace } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, lte, or, desc } from "drizzle-orm";

interface GetPublishedAssetInput {
  assetID: string;
  variant: (typeof assetDeliveryVariants)[number];
}

// Publication is the access grant. Asset ownership alone never grants public access.
const getPublishedAsset = withPublicWorkspace<GetPublishedAssetInput, File>(
  {},
  async ({ database, workspaceID, input }) => {
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
        entryPublications,
        and(
          eq(entryPublications.versionID, entryVersionAssets.versionID),
          eq(entryPublications.workspaceID, workspaceID)
        )
      )
      .innerJoin(entries, and(eq(entries.id, entryPublications.entryID), isNull(entries.deletedAt)))
      .where(
        and(
          eq(assets.workspaceID, workspaceID),
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
