import { publishingChannels } from "#backend/db";
import type { Database } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { normalizePublishingChannelCode } from "./channel";
import { publishingSnapshotChangedError } from "./errors";

// Call inside the mutation transaction. Hold the channel lock until commit.
const assertPublishingSnapshot = async (
  database: Database,
  workspaceID: string,
  channel: string,
  expectedSnapshotID?: string
): Promise<void> => {
  if (!expectedSnapshotID) return;

  const code = normalizePublishingChannelCode(channel);
  const [row] = await database
    .select({ snapshotID: publishingChannels.currentSnapshotID })
    .from(publishingChannels)
    .where(
      and(
        eq(publishingChannels.workspaceID, workspaceID),
        eq(publishingChannels.code, code),
        isNull(publishingChannels.deletedAt)
      )
    )
    .for("update");

  if (!row) throw new ORPCError("NOT_FOUND", { message: "Publishing channel not found" });

  if (!row.snapshotID) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Publishing channel has no current snapshot"
    });
  }

  if (row.snapshotID !== toUUID(expectedSnapshotID)) {
    throw publishingSnapshotChangedError(code, toUUID(expectedSnapshotID), row.snapshotID);
  }
};

export { assertPublishingSnapshot };
