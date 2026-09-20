import type { CollectionSelector } from "#backend/lib/content/paths";
import { normalizePublishingChannelCode } from "./channel";
import { PUBLISHED_CHANNEL_CODE } from "./config";
import { resolvePublishingSnapshot } from "./snapshot-state";
import type { PageInput } from "#backend/lib/api/pagination";
import type { Database } from "#backend/lib/policy";
import { ORPCError } from "@orpc/server";

interface PublishedPageInput extends PageInput, CollectionSelector {
  channel?: string;
  snapshotID?: string;
}

const resolvePublishedPage = (
  database: Database,
  workspaceID: string,
  input: PublishedPageInput
) => {
  if (input.cursor && !input.snapshotID) {
    throw new ORPCError("BAD_REQUEST", {
      message: "A snapshotID is required when continuing a published listing",
      data: { hints: ["Use the snapshotID and nextCursor returned by the previous page."] }
    });
  }

  return resolvePublishingSnapshot(
    database,
    workspaceID,
    input.snapshotID
      ? { snapshotID: input.snapshotID }
      : { channelCode: normalizePublishingChannelCode(input.channel || PUBLISHED_CHANNEL_CODE) }
  );
};

export { resolvePublishedPage };
export type { PublishedPageInput };
