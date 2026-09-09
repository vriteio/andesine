import { assetUploads, assets, entries, workspaces } from "#backend/db";
import { type Database, type ServiceResolveContext } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface AssetInput {
  assetID: string;
  entryID?: string;
}

const loadAssetWorkspace = async (database: Database, workspaceID: string) => {
  const [workspace] = await database
    .select({ deletingAt: workspaces.deletingAt, subscriptionPlan: workspaces.subscriptionPlan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceID));

  if (!workspace || workspace.deletingAt) {
    throw new ORPCError("NOT_FOUND", { message: "Workspace is not available" });
  }
  return workspace;
};
const loadAssetUpload = async ({
  database,
  workspaceID,
  input
}: ServiceResolveContext<AssetInput>) => {
  await loadAssetWorkspace(database, workspaceID);
  const [row] = await database
    .select({ asset: assets, upload: assetUploads, collectionID: entries.collectionID })
    .from(assets)
    .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
    .innerJoin(
      entries,
      and(
        eq(entries.id, assetUploads.entryID),
        eq(entries.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    )
    .where(and(eq(assets.id, toUUID(input.assetID)), eq(assets.workspaceID, workspaceID)));

  if (!row || row.upload.expiresAt <= new Date() || row.asset.status === "deleting") {
    throw new ORPCError("NOT_FOUND", { message: "Upload is not available" });
  }
  return row;
};

export { loadAssetUpload, loadAssetWorkspace };
export type { AssetInput };
