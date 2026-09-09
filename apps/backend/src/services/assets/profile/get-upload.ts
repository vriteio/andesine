import { assets, assetUploads } from "#backend/db";
import {
  getProfileOwner,
  profileOwnerCondition,
  type ProfileImageInput
} from "#backend/lib/assets/profiles";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { and, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";

interface GetProfileUploadInput extends ProfileImageInput {
  assetID: string;
}

const getProfileImageUpload = withAuthorization<
  GetProfileUploadInput,
  undefined,
  {
    status: typeof assets.$inferSelect.status;
    failureReason: string | null;
  }
>(
  { permissions: (input) => ({ session: input.target === "workspace" ? ["workspace"] : true }) },
  async ({ database, auth, input }) => {
    const owner = getProfileOwner(auth, input.target);
    const [row] = await database
      .select({ status: assets.status, failureReason: assetUploads.failureReason })
      .from(assets)
      .innerJoin(assetUploads, eq(assetUploads.assetID, assets.id))
      .where(
        and(
          eq(assets.id, toUUID(input.assetID)),
          profileOwnerCondition(owner),
          isNull(assetUploads.entryID)
        )
      );
    if (!row) throw new ORPCError("NOT_FOUND");
    return row;
  }
);

export { getProfileImageUpload };
