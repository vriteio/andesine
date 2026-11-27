import { workspaces } from "@andesine/server/database";
import { type SharingPolicy } from "@andesine/contracts/entities";
import { eq } from "drizzle-orm";
import { withAuthorization } from "#backend/lib/policy";
import { loadSharingPolicy } from "#backend/lib/shares";

const getSharingPolicy = withAuthorization<object, undefined, SharingPolicy>(
  {},
  ({ database, workspaceID }) => loadSharingPolicy(database, workspaceID)
);
/** Off pauses a kind's shares without removing them. */
const updateSharingPolicy = withAuthorization<Partial<SharingPolicy>, undefined, SharingPolicy>(
  { permissions: { session: ["workspace"] } },
  async ({ database, input, workspaceID }) => {
    const isEmpty = Object.values(input).every((value) => value === undefined);

    if (isEmpty) return loadSharingPolicy(database, workspaceID);

    await database
      .update(workspaces)
      .set({
        linkSharing: input.linkSharing,
        emailSharing: input.emailSharing,
        maxShareExpiryDays: input.maxExpiryDays
      })
      .where(eq(workspaces.id, workspaceID));

    return loadSharingPolicy(database, workspaceID);
  }
);

export { getSharingPolicy, updateSharingPolicy };
