import { assets, entries, entryAssets } from "#backend/db";
import { loadAssetWorkspace } from "#backend/lib/assets/access";
import { withAuthorization } from "#backend/lib/policy";
import { toAssetID, toEntryID, toUUID } from "#backend/lib/primitives";
import { getVectorQuery, IMAGE_SEARCH_COLLECTION_ALIAS } from "#backend/lib/search";
import { searchOpenAIClient, searchTypesenseClient } from "#backend/lib/search/clients";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { getAsset } from "./get";

interface AssetSearchInput {
  checksum?: string;
  query: string;
  semantic: boolean;
  limit: number;
}
interface AssetSearchResult {
  assetID: string;
  entryID: string;
  entryName: string;
  filename: string;
  description: string;
  thumbnailURL: string;
  width: number;
  height: number;
}

const IMAGE_SEARCH_MAX_VECTOR_DISTANCE = 0.6;

const searchAssets = withAuthorization<AssetSearchInput, undefined, AssetSearchResult[]>(
  { tree: true, permissions: { session: true, key: ["read:entries", "read:collections"] } },
  async ({ database, workspaceID, authorization, input, auth }) => {
    await loadAssetWorkspace(database, workspaceID);

    const collectionIDs = authorization.collections
      .filter(({ id }) => authorization.canEntry(id, "entry:read"))
      .map(({ id }) => toUUID(id));

    if (!collectionIDs.length && !authorization.canEntry(null, "entry:read")) return [];

    const sources = await database
      .selectDistinctOn([assets.id], {
        assetID: assets.id,
        entryID: entries.id,
        entryName: entries.name
      })
      .from(assets)
      .innerJoin(entryAssets, eq(entryAssets.assetID, assets.id))
      .innerJoin(entries, eq(entries.id, entryAssets.entryID))
      .where(
        and(
          input.checksum ? eq(assets.sourceChecksum, input.checksum) : undefined,
          eq(assets.workspaceID, workspaceID),
          eq(entries.workspaceID, workspaceID),
          eq(assets.status, "ready"),
          isNull(entries.deletedAt),
          isNull(entryAssets.pendingUntil),
          or(
            collectionIDs.length ? inArray(entries.collectionID, collectionIDs) : undefined,
            authorization.canEntry(null, "entry:read") ? isNull(entries.collectionID) : undefined
          )
        )
      )
      .orderBy(assets.id, entries.id);

    if (!sources.length) return [];

    const sourceByID = new Map(sources.map((source) => [source.assetID, source]));
    const [embedding] =
      input.semantic && input.query && !input.checksum
        ? await searchOpenAIClient.createEmbeddings([input.query]).catch(() => [])
        : [];
    const result = input.checksum
      ? { hits: sources.slice(0, input.limit).map(({ assetID }) => ({ document: { assetID } })) }
      : await searchTypesenseClient.searchDocuments<{ assetID: string }>(
          IMAGE_SEARCH_COLLECTION_ALIAS,
          {
            q: input.query || "*",
            query_by: "filename,description,extractedText",
            query_by_weights: "4,2,1",
            drop_tokens_threshold: 0,
            filter_by: `workspaceID:=${workspaceID} && assetID:=[${sources.map(({ assetID }) => assetID).join(",")}]`,
            per_page: input.limit,
            include_fields: "assetID",
            sort_by: "_text_match:desc,updatedAt:desc",
            ...(embedding && {
              vector_query: getVectorQuery(
                embedding,
                input.limit,
                IMAGE_SEARCH_MAX_VECTOR_DISTANCE
              ),
              rerank_hybrid_matches: true
            })
          }
        );
    const results = await Promise.all(
      (result.hits || []).map(async ({ document }) => {
        const source = sourceByID.get(document.assetID);
        if (!source) return null;

        try {
          // Recheck access and current references before signing a thumbnail URL.
          const details = await getAsset({
            assetID: toAssetID(source.assetID),
            entryID: toEntryID(source.entryID),
            auth
          });
          const thumbnail = details.files.find(({ variant }) => variant === "thumbnail");
          const display = details.files.find(({ variant }) => variant === "display");
          if (!thumbnail || !display) return null;

          return {
            assetID: details.assetID,
            entryID: toEntryID(source.entryID),
            entryName: source.entryName,
            filename: details.filename,
            description: details.analysis?.description || "",
            thumbnailURL: thumbnail.url,
            width: display.width,
            height: display.height
          };
        } catch (error) {
          if (error instanceof ORPCError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code))
            return null;
          throw error;
        }
      })
    );

    return results.filter((result): result is AssetSearchResult => result !== null);
  }
);

export { searchAssets };
export type { AssetSearchResult };
