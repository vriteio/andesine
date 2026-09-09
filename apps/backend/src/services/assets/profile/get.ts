import { assetFiles, assets, users, workspaces } from "#backend/db";
import { db } from "#backend/lib/adapters/postgres";
import { requireAssetStorage } from "#backend/lib/assets/client";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, or } from "drizzle-orm";

const getProfileImage = async (input: { assetID: string }): Promise<File> => {
  const [file] = await db
    .select({ file: assetFiles })
    .from(assetFiles)
    .innerJoin(assets, and(eq(assets.id, assetFiles.assetID), eq(assets.status, "ready")))
    .leftJoin(
      workspaces,
      and(
        eq(workspaces.id, assets.workspaceID),
        eq(workspaces.logoAssetID, assets.id),
        isNull(workspaces.deletingAt)
      )
    )
    .leftJoin(
      users,
      and(eq(users.id, assets.userID), eq(users.imageAssetID, assets.id), isNull(users.deletingAt))
    )
    .where(
      and(
        eq(assets.id, toUUID(input.assetID)),
        eq(assetFiles.variant, "display"),
        or(eq(workspaces.logoAssetID, assets.id), eq(users.imageAssetID, assets.id))
      )
    )
    .limit(1);
  if (!file) throw new ORPCError("NOT_FOUND");
  const bytes = await requireAssetStorage().read(file.file.objectKey, file.file.byteSize);
  return new File([new Uint8Array(bytes)], `${input.assetID}.${file.file.format}`, {
    type: `image/${file.file.format}`
  });
};

export { getProfileImage };
