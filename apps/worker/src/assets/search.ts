import { assetAnalyses, assets, workspaces } from "@andesine/backend/db";
import { IMAGE_SEARCH_COLLECTION_ALIAS, type TypesenseClient } from "@andesine/backend/lib/search";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { config } from "../config";
import { db } from "../database";

const indexAssetSearch = async (typesense: TypesenseClient): Promise<void> => {
  const rows = await db
    .select({ asset: assets })
    .from(assetAnalyses)
    .innerJoin(assets, eq(assets.id, assetAnalyses.assetID))
    .innerJoin(workspaces, eq(workspaces.id, assets.workspaceID))
    .where(
      and(
        eq(assets.status, "ready"),
        isNull(workspaces.deletingAt),
        or(isNull(assetAnalyses.indexedAt), lt(assetAnalyses.indexedAt, assetAnalyses.updatedAt))
      )
    )
    .orderBy(assetAnalyses.updatedAt)
    .limit(100);

  for (const { asset } of rows) {
    await db.transaction(async (database) => {
      const [workspace] = await database
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.id, asset.workspaceID!), isNull(workspaces.deletingAt)))
        .for("update");
      if (!workspace) return;

      const [current] = await database
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.id, asset.id), eq(assets.status, "ready")));
      if (!current) return;

      const [analysis] = await database
        .select()
        .from(assetAnalyses)
        .where(eq(assetAnalyses.assetID, asset.id))
        .for("update");
      if (!analysis) return;

      const embedding =
        analysis.embeddingModel === config.SEARCH_EMBEDDING_MODEL &&
        analysis.embeddingDimensions === config.SEARCH_EMBEDDING_DIMENSIONS
          ? analysis.embedding
          : null;

      await typesense.importDocuments(IMAGE_SEARCH_COLLECTION_ALIAS, [
        {
          id: asset.id,
          assetID: asset.id,
          workspaceID: asset.workspaceID,
          filename: asset.filename,
          description: analysis.description || "",
          extractedText: analysis.extractedText || "",
          updatedAt: Math.floor(asset.createdAt.getTime() / 1000),
          ...(embedding && { embedding })
        }
      ]);
      // The row lock keeps analysis updates from racing with the indexed marker.
      await database
        .update(assetAnalyses)
        .set({ indexedAt: new Date() })
        .where(eq(assetAnalyses.assetID, asset.id));
    });
  }
};

export { indexAssetSearch };
