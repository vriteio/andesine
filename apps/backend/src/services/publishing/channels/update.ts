import { publishingChannels } from "@andesine/server/database";
import { mapPublishingChannel, type PublishingChannel } from "#backend/lib/data";
import { withAuthorization } from "#backend/lib/policy";
import { normalizePublishingChannelCode } from "#backend/lib/publishing";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface UpdateChannelInput {
  code: string;
  name: string;
}

/** Renames a channel. Its code stays, because reads, snapshots, and webhooks use it. */
const updateChannel = withAuthorization<UpdateChannelInput, undefined, PublishingChannel>(
  {
    permissions: { session: ["publishing"], key: ["publishing"] },
    transaction: "locked-workspace"
  },
  async ({ database, input, workspaceID }) => {
    const [channel] = await database
      .update(publishingChannels)
      .set({ name: input.name.trim(), updatedAt: new Date() })
      .where(
        and(
          eq(publishingChannels.workspaceID, workspaceID),
          eq(publishingChannels.code, normalizePublishingChannelCode(input.code)),
          isNull(publishingChannels.deletedAt)
        )
      )
      .returning();

    if (!channel) throw new ORPCError("NOT_FOUND", { message: "Publishing channel not found" });

    return mapPublishingChannel(channel);
  }
);

export { updateChannel };
