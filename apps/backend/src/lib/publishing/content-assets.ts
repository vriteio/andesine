import { assetFiles, entryVersionAssets } from "#backend/db";
import { getDeliveryFiles } from "#backend/lib/assets/files";
import { config } from "#backend/lib/config";
import type { Database } from "#backend/lib/policy";
import { toAssetID, toEntryID, toSnapshotID, toWorkspaceID } from "#backend/lib/primitives";
import { and, eq, inArray } from "drizzle-orm";

interface PublishedAssetVersion {
  id: string;
  entryID: string;
}

const loadPublishedAssets = async (
  database: Database,
  workspaceID: string,
  snapshotID: string,
  versions: PublishedAssetVersion[]
) => {
  const files = versions.length
    ? await database
        .select({
          versionID: entryVersionAssets.versionID,
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
            inArray(
              entryVersionAssets.versionID,
              versions.map(({ id }) => id)
            )
          )
        )
        .orderBy(assetFiles.assetID, assetFiles.variant)
    : [];
  const filesByVersion = new Map<string, Array<Omit<(typeof files)[number], "versionID">>>();

  for (const file of files) {
    const { versionID, ...versionFile } = file;
    const versionFiles = filesByVersion.get(versionID) || [];

    versionFiles.push(versionFile);
    filesByVersion.set(versionID, versionFiles);
  }

  return new Map(
    versions.map((version) => [
      version.id,
      getDeliveryFiles(filesByVersion.get(version.id) || []).map((file) => ({
        ...file,
        assetID: toAssetID(file.assetID),
        url: `${config.PUBLIC_API_URL}/content/assets/${toWorkspaceID(workspaceID)}/${toSnapshotID(snapshotID)}/${toEntryID(version.entryID)}/${toAssetID(file.assetID)}/${file.variant}`
      }))
    ])
  );
};

export { loadPublishedAssets };
