import {
  assetFiles,
  assets,
  entryVersionAssets,
  publishingSnapshotEntries,
  workspaces
} from "@andesine/server/database";
import { getDeliveryFiles } from "@andesine/server/assets";
import { type assetDeliveryVariants } from "@andesine/contracts/assets";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { resolvePublishingSnapshot } from "#backend/lib/publishing";
import { withPublicWorkspace } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

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
    const files = await database
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
          eq(assets.id, toUUID(input.assetID))
        )
      );
    // The delivery roles say which file serves the variant, e.g. a small display file as the thumbnail.
    const file = getDeliveryFiles(files.map(({ file }) => file)).find(({ variant }) => {
      return variant === input.variant;
    });

    if (!file) throw new ORPCError("NOT_FOUND");

    const storage = requireAssetStorage();
    const bytes = await storage.read(file.objectKey, file.byteSize);

    return new File([new Uint8Array(bytes)], `${input.assetID}.${file.format}`, {
      type: `image/${file.format}`
    });
  }
);

export { getPublishedAsset };
