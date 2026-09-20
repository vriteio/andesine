import { mapPublishingChannel, type PublishingChannel } from "#backend/lib/data";
import { withAuthorization } from "#backend/lib/policy";
import {
  createInitialPublishingChannel,
  normalizePublishingChannelCode
} from "#backend/lib/publishing";
import { ORPCError } from "@orpc/server";

interface CreateChannelInput {
  name: string;
}

const createChannel = withAuthorization<CreateChannelInput, undefined, PublishingChannel>(
  {
    permissions: { session: ["publishing"], key: ["publishing"] },
    transaction: "atomic"
  },
  async ({ auth, database, input, workspaceID }) => {
    const name = input.name.trim();
    const code = normalizePublishingChannelCode(name);

    const channel = await createInitialPublishingChannel(database, {
      workspaceID,
      code,
      name,
      creatorID: auth.session?.userID
    });

    if (!channel) {
      throw new ORPCError("CONFLICT", {
        message: "A publishing channel with this code exists",
        data: {
          hints: [
            "Use publishing.listChannels to check existing channels. Choose a name that produces a different channel code."
          ]
        }
      });
    }

    return mapPublishingChannel(channel);
  }
);

export { createChannel };
