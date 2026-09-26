import { publishingChannels, publishingSnapshots } from "@andesine/server/database";
import {
  createOutboundEvent,
  createWebhookOperation,
  createWebhookRecorder
} from "@andesine/server/webhooks/recording";
import { webhookRetentionPolicy } from "#backend/lib/webhooks/policy";
import { assertPublishingSnapshot } from "#backend/lib/publishing/precondition";
import { withAuthorization } from "#backend/lib/policy";
import { toSnapshotID, toWorkspaceID } from "@andesine/contracts/primitives";
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
    transaction: "locked-workspace"
  },
  async ({ auth, database, input, workspaceID }) => {
    const code = normalizePublishingChannelCode(input.code);
    const now = new Date();
    const expiresAt = getPublishingSnapshotExpiry(auth.subscriptionPlan, now);
    const operation = createWebhookOperation(toWorkspaceID(workspaceID));
    const recorder = await createWebhookRecorder({
      retentionPolicy: webhookRetentionPolicy,
      database,
      operation
    });

    await assertPublishingSnapshot(database, workspaceID, input.code, input.expectedSnapshotID);

    const [channel] = await database
      .select({
        id: publishingChannels.id,
        name: publishingChannels.name,
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

    await recorder.record([
      {
        event: createOutboundEvent(
          operation,
          "channel-deleted",
          {
            type: "publishing.channel_deleted",
            subject: { kind: "channel", code },
            data: { name: channel.name, snapshotID: toSnapshotID(channel.currentSnapshotID) }
          },
          now
        ),
        resources: []
      }
    ]);

    return { channelID: channel.id };
  }
);

export { deleteChannel };
