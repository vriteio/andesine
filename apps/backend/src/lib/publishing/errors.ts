import { toSnapshotID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";

const publishingSnapshotChangedError = (
  channel: string,
  expectedSnapshotID: string,
  currentSnapshotID: string
) => {
  return new ORPCError("PUBLISHING_SNAPSHOT_CHANGED", {
    status: 409,
    message: "Publishing snapshot changed",
    data: {
      channel,
      expectedSnapshotID: toSnapshotID(expectedSnapshotID),
      currentSnapshotID: toSnapshotID(currentSnapshotID),
      hints: [
        "Read the current channel state again and review the changes before submitting another request."
      ]
    }
  });
};

export { publishingSnapshotChangedError };
