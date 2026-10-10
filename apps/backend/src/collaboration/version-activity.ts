import {
  entryVersionActivity,
  entryVersionActivityContributors,
  memberships,
  type DatabaseTransaction
} from "@andesine/server/database";
import {
  AUTOMATIC_VERSION_MAX_PERIOD_MS,
  AUTOMATIC_VERSION_QUIET_PERIOD_MS
} from "#backend/lib/versioning/config";
import { and, eq, inArray, sql } from "drizzle-orm";

interface RecordVersionActivityInput {
  entryID: string;
  workspaceID: string;
  /** Membership UUIDs of the members whose edits the save contains. */
  contributorIDs: string[];
  contentChanged: boolean;
}

/** Schedules the automatic version after a content change and adds the save's contributors. */
const recordVersionActivity = async (
  tx: DatabaseTransaction,
  input: RecordVersionActivityInput
): Promise<void> => {
  const { entryID, workspaceID, contributorIDs, contentChanged } = input;

  if (contentChanged) {
    const now = new Date();

    await tx
      .insert(entryVersionActivity)
      .values({
        entryID,
        workspaceID,
        dueAt: new Date(now.getTime() + AUTOMATIC_VERSION_QUIET_PERIOD_MS),
        firstChangedAt: now,
        lastChangedAt: now
      })
      .onConflictDoUpdate({
        target: entryVersionActivity.entryID,
        set: {
          lastChangedAt: sql`now()`,
          dueAt: sql`least(
            ${entryVersionActivity.firstChangedAt} + ${AUTOMATIC_VERSION_MAX_PERIOD_MS} * interval '1 millisecond',
            now() + ${AUTOMATIC_VERSION_QUIET_PERIOD_MS} * interval '1 millisecond'
          )`
        }
      });
  }

  if (contributorIDs.length > 0) {
    const [activity] = await tx
      .select({ entryID: entryVersionActivity.entryID })
      .from(entryVersionActivity)
      .where(eq(entryVersionActivity.entryID, entryID));

    if (activity) {
      const contributors = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(eq(memberships.workspaceID, workspaceID), inArray(memberships.id, contributorIDs))
        )
        .for("key share");

      if (contributors.length > 0) {
        await tx
          .insert(entryVersionActivityContributors)
          .values(
            contributors.map(({ id: membershipID }) => ({
              workspaceID,
              entryID,
              membershipID
            }))
          )
          .onConflictDoNothing();
      }
    }
  }
};

export { recordVersionActivity };
