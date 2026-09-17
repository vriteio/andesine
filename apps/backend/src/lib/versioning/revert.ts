import type { ContentNode } from "#backend/lib/content";
import { config } from "#backend/lib/config";
import { entryAssets, entryVersionAssets, entryVersions } from "#backend/db";
import type { db } from "#backend/lib/adapters";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNotNull, or } from "drizzle-orm";

interface VersionRevertTargetInput {
  entryID: string;
  versionID: string;
}
interface VersionRevertTarget {
  document: ContentNode;
  entryID: string;
  entryName: string;
  hash: string;
  schemaRevisionID: string | null;
  versionID: string;
}

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const loadVersionRevertTargets = async (
  database: DatabaseTransaction,
  workspaceID: string,
  inputs: VersionRevertTargetInput[]
): Promise<VersionRevertTarget[]> => {
  const targets = [
    ...new Map(
      inputs.map((input) => [
        `${toUUID(input.entryID)}:${toUUID(input.versionID)}`,
        { entryID: toUUID(input.entryID), versionID: toUUID(input.versionID) }
      ])
    ).values()
  ];

  if (targets.length === 0) return [];

  const rows = await database
    .select({
      document: entryVersions.document,
      entryID: entryVersions.entryID,
      entryName: entryVersions.entryName,
      hash: entryVersions.hash,
      schemaRevisionID: entryVersions.schemaRevisionID,
      versionID: entryVersions.id
    })
    .from(entryVersions)
    .where(
      and(
        eq(entryVersions.workspaceID, workspaceID),
        or(
          ...targets.map((target) => {
            return and(
              eq(entryVersions.entryID, target.entryID),
              eq(entryVersions.id, target.versionID)
            );
          })
        )
      )
    );

  if (rows.length !== targets.length) {
    throw new ORPCError("CONFLICT", { message: "Published entry version changed" });
  }

  return rows;
};
const retainRevertedVersionAssets = async (
  database: DatabaseTransaction,
  workspaceID: string,
  input: VersionRevertTargetInput
): Promise<void> => {
  const entryID = toUUID(input.entryID);
  const versionID = toUUID(input.versionID);
  const targetImages = await database
    .select({ assetID: entryVersionAssets.assetID })
    .from(entryVersionAssets)
    .where(
      and(
        eq(entryVersionAssets.workspaceID, workspaceID),
        eq(entryVersionAssets.entryID, entryID),
        eq(entryVersionAssets.versionID, versionID)
      )
    );

  if (targetImages.length === 0) return;

  const pendingUntil = new Date(Date.now() + config.ASSET_UPLOAD_EXPIRY_HOURS * 3600_000);

  await database
    .insert(entryAssets)
    .values(
      targetImages.map(({ assetID }) => ({
        workspaceID,
        entryID,
        assetID,
        pendingUntil
      }))
    )
    .onConflictDoUpdate({
      target: [entryAssets.entryID, entryAssets.assetID],
      set: { pendingUntil },
      setWhere: isNotNull(entryAssets.pendingUntil)
    });
};

export { loadVersionRevertTargets, retainRevertedVersionAssets };
export type { VersionRevertTarget, VersionRevertTargetInput };
