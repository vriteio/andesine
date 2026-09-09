import { IMAGE_SEARCH_COLLECTION_ALIAS, type TypesenseClient } from "@andesine/backend/lib/search";
import { users } from "@andesine/backend/db/users";
import { lockProfileOwner } from "@andesine/backend/lib/assets/profiles";
import {
  assetAnalyses,
  assets,
  entryAssets,
  entryVersionAssets
} from "@andesine/backend/db/assets";
import { assetStorageDeletions, assetUploads } from "@andesine/backend/db/asset-uploads";
import { workspaces } from "@andesine/backend/db/workspaces";
import { entries } from "@andesine/backend/db/entries";
import {
  getOwnedAssetPrefix,
  getOwnedAssetUploadKey,
  getOwnedAssetStagingPrefix,
  type AssetOwner,
  type AssetStorage
} from "@andesine/backend/lib/assets/storage";
import {
  ASSET_PROCESS_JOB_NAME,
  PROFILE_IMAGE_JOB_NAME
} from "@andesine/backend/lib/queue/asset-jobs";
import { and, eq, exists, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Queue } from "bullmq";
import { config } from "../config";
import { db } from "../database";

// Indexed reference checks avoid reading content documents during routine cleanup.
const hasAssetReferences = sql`(exists (
  select 1 from ${entryAssets} where ${entryAssets.workspaceID} = ${assets.workspaceID}
    and ${entryAssets.assetID} = ${assets.id}
) or exists (
  select 1 from ${entryVersionAssets} where ${entryVersionAssets.workspaceID} = ${assets.workspaceID}
    and ${entryVersionAssets.assetID} = ${assets.id}
) or exists (
  select 1 from ${workspaces} where ${workspaces.id} = ${assets.workspaceID} and ${workspaces.logoAssetID} = ${assets.id}
) or exists (
  select 1 from ${users} where ${users.id} = ${assets.userID} and ${users.imageAssetID} = ${assets.id}
))`;

const maintainAsset = async (
  assetID: string,
  owner: AssetOwner,
  storage: AssetStorage,
  typesense: TypesenseClient
): Promise<void> => {
  const deleting = await db.transaction(async (database) => {
    await lockProfileOwner(database, owner);

    const [row] = await database
      .select({ asset: assets, upload: assetUploads })
      .from(assets)
      .leftJoin(assetUploads, eq(assetUploads.assetID, assets.id))
      .where(eq(assets.id, assetID));
    if (!row) return;

    const upload = row.upload;

    if (row.asset.status === "ready") {
      if (upload) {
        await storage.removeKeys([getOwnedAssetUploadKey(owner, assetID)]);
        if (upload.expiresAt <= new Date()) {
          await database.delete(assetUploads).where(eq(assetUploads.assetID, assetID));
        } else {
          await database
            .update(assetUploads)
            .set({ reservedBytes: 0, updatedAt: new Date() })
            .where(eq(assetUploads.assetID, assetID));
        }
      }
      const [reference] = await database
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.id, assetID), hasAssetReferences));
      if (reference || (upload && upload.expiresAt > new Date())) return;

      if (!row.asset.unreferencedAt) {
        await database
          .update(assets)
          .set({ unreferencedAt: new Date(), updatedAt: new Date() })
          .where(eq(assets.id, assetID));
        return;
      }

      if (row.asset.unreferencedAt.getTime() > Date.now() - config.ASSET_RETENTION_DAYS * 86400_000)
        return;

      // Commit this state before deleting files. A partial storage failure must not permit reuse.
      await database
        .update(assets)
        .set({ status: "deleting", updatedAt: new Date() })
        .where(eq(assets.id, assetID));
      return true;
    }

    const expiresAt =
      upload?.expiresAt ||
      new Date(row.asset.createdAt.getTime() + config.ASSET_UPLOAD_EXPIRY_HOURS * 3600_000);
    if (row.asset.status !== "deleting" && expiresAt > new Date()) return;

    const [currentReference] = await database
      .select({ assetID: entryAssets.assetID })
      .from(entryAssets)
      .where(eq(entryAssets.assetID, assetID))
      .limit(1);
    const [versionReference] = await database
      .select({ assetID: entryVersionAssets.assetID })
      .from(entryVersionAssets)
      .where(eq(entryVersionAssets.assetID, assetID))
      .limit(1);
    if (currentReference || versionReference) return;

    // Retain the records and quota reservation until physical deletion succeeds.
    await storage.removePrefix(getOwnedAssetPrefix(owner, assetID));
    await storage.removePrefix(getOwnedAssetStagingPrefix(owner, assetID));
    const [analysis] = await database
      .select({ assetID: assetAnalyses.assetID })
      .from(assetAnalyses)
      .where(eq(assetAnalyses.assetID, assetID));

    if (analysis) {
      await typesense.deleteDocuments(IMAGE_SEARCH_COLLECTION_ALIAS, `assetID:=${assetID}`);
    }

    await database.delete(assets).where(eq(assets.id, assetID));
  });

  if (deleting) await maintainAsset(assetID, owner, storage, typesense);
};
const maintainAssets = async (
  queue: Queue,
  storage: AssetStorage,
  typesense: TypesenseClient
): Promise<void> => {
  const deletions = await db
    .select()
    .from(assetStorageDeletions)
    .orderBy(assetStorageDeletions.updatedAt)
    .limit(25);

  for (const deletion of deletions) {
    try {
      await storage.removePrefix(deletion.prefix);
      const workspaceID = deletion.prefix.match(/^workspaces\/([a-f0-9-]{36})\/assets\/$/)?.[1];

      if (workspaceID) {
        await typesense.deleteDocuments(
          IMAGE_SEARCH_COLLECTION_ALIAS,
          `workspaceID:=${workspaceID}`
        );
      }
      await db.delete(assetStorageDeletions).where(eq(assetStorageDeletions.id, deletion.id));
    } catch (error) {
      await db
        .update(assetStorageDeletions)
        .set({ updatedAt: new Date() })
        .where(eq(assetStorageDeletions.id, deletion.id));
      console.error("Failed to delete workspace image files; will retry", {
        error,
        deletionID: deletion.id
      });
    }
  }

  // Soft deletion does not run foreign-key cascades. Release current references,
  // but keep saved-version references until those versions are removed.
  await db.delete(entryAssets).where(
    or(
      lte(entryAssets.pendingUntil, new Date()),
      exists(
        db
          .select({ id: entries.id })
          .from(entries)
          .where(
            and(
              eq(entries.workspaceID, entryAssets.workspaceID),
              eq(entries.id, entryAssets.entryID),
              isNotNull(entries.deletedAt)
            )
          )
      )
    )
  );

  const processing = await db
    .select({ assetID: assets.id, workspaceID: assets.workspaceID })
    .from(assets)
    .innerJoin(
      assetUploads,
      and(eq(assetUploads.assetID, assets.id), gt(assetUploads.expiresAt, new Date()))
    )
    .innerJoin(entries, and(eq(entries.id, assetUploads.entryID), isNull(entries.deletedAt)))
    .innerJoin(
      workspaces,
      and(eq(workspaces.id, assets.workspaceID), isNull(workspaces.deletingAt))
    )
    .where(eq(assets.status, "processing"))
    .orderBy(assets.updatedAt)
    .limit(100);
  for (const row of processing) {
    if (!row.workspaceID) continue;
    await queue.add(ASSET_PROCESS_JOB_NAME, row, {
      jobId: `asset-${row.assetID}`,
      removeOnComplete: true,
      removeOnFail: true
    });
  }

  const profileProcessing = await db
    .select({ assetID: assets.id })
    .from(assets)
    .innerJoin(
      assetUploads,
      and(eq(assetUploads.assetID, assets.id), gt(assetUploads.expiresAt, new Date()))
    )
    .where(and(eq(assets.status, "processing"), isNull(assetUploads.entryID)))
    .orderBy(assets.updatedAt)
    .limit(100);
  for (const row of profileProcessing) {
    await queue.add(PROFILE_IMAGE_JOB_NAME, row, {
      jobId: `profile-image-${row.assetID}`,
      removeOnComplete: true,
      removeOnFail: true
    });
  }

  const expiryThreshold = new Date(Date.now() - config.ASSET_UPLOAD_EXPIRY_HOURS * 3600_000);
  const candidates = await db
    .select({ assetID: assets.id, workspaceID: assets.workspaceID, userID: assets.userID })
    .from(assets)
    .leftJoin(assetUploads, eq(assetUploads.assetID, assets.id))
    .where(
      or(
        eq(assets.status, "deleting"),
        and(
          eq(assets.status, "ready"),
          sql`not (${hasAssetReferences})`,
          or(isNull(assetUploads.assetID), lte(assetUploads.expiresAt, new Date())),
          or(
            isNull(assets.unreferencedAt),
            lte(
              assets.unreferencedAt,
              new Date(Date.now() - config.ASSET_RETENTION_DAYS * 86400_000)
            )
          )
        ),
        and(
          eq(assets.status, "ready"),
          or(sql`${assetUploads.reservedBytes} > 0`, lt(assetUploads.expiresAt, new Date()))
        ),
        and(
          inArray(assets.status, ["pending", "processing", "failed"]),
          or(
            lt(assetUploads.expiresAt, new Date()),
            and(isNull(assetUploads.assetID), lt(assets.createdAt, expiryThreshold))
          )
        )
      )
    )
    .orderBy(assets.updatedAt)
    .limit(100);

  for (const row of candidates) {
    try {
      await maintainAsset(
        row.assetID,
        { workspaceID: row.workspaceID, userID: row.userID },
        storage,
        typesense
      );
    } catch (error) {
      console.error("Failed to maintain image upload; will retry", { error, assetID: row.assetID });
    }
  }
};

export { maintainAssets };
