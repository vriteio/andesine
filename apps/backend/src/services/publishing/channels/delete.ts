import { assertPublishingSnapshot } from "#backend/lib/publishing/precondition";
import { publishingChannels, publishingSnapshots } from "#backend/db";
import { withAuthorization } from "#backend/lib/policy";
import {
  getPublishingSnapshotExpiry,
  normalizePublishingChannelCode
} from "#backend/lib/publishing";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface DeleteChannelInput {
  code: string;
  expectedSnapshotID?: string;
}
interface DeleteChannelResult {
  channelID: string;
}

const deleteChannel = withAuthorization<DeleteChannelInput, undefined, DeleteChannelResult>(
  {
    permissions: { session: ["publishing"], key: ["publishing"] },
    transaction: "atomic"
  },
  async ({ auth, database, input, workspaceID }) => {
    await assertPublishingSnapshot(database, workspaceID, input.code, input.expectedSnapshotID);

    const code = normalizePublishingChannelCode(input.code);
    const now = new Date();
    const expiresAt = getPublishingSnapshotExpiry(auth.subscriptionPlan, now);

    const [channel] = await database
      .select({
        id: publishingChannels.id,
        builtIn: publishingChannels.builtIn,
        currentSnapshotID: publishingChannels.currentSnapshotID
      })
      .from(publishingChannels)
      .where(
        and(
          eq(publishingChannels.workspaceID, workspaceID),
          eq(publishingChannels.code, code),
          isNull(publishingChannels.deletedAt)
        )
      )
      .for("update");

    if (!channel) throw new ORPCError("NOT_FOUND", { message: "Publishing channel not found" });
    if (channel.builtIn) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Built-in publishing channels cannot be deleted"
      });
    }

    if (!channel.currentSnapshotID) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Publishing channel has no current snapshot"
      });
    }

    await database
      .update(publishingSnapshots)
      .set({ supersededAt: now, expiresAt })
      .where(eq(publishingSnapshots.id, channel.currentSnapshotID));
    await database
      .update(publishingChannels)
      .set({ currentSnapshotID: null, deletedAt: now, updatedAt: now })
      .where(eq(publishingChannels.id, channel.id));

    return { channelID: channel.id };
  }
);

export { deleteChannel };
