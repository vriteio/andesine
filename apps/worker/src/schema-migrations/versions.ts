import {
  schemaMigrationEntries,
  entryVersionContributors,
  entryVersions
} from "@andesine/server/database";
import { mapVersionSummary } from "@andesine/server/data";
import { toWorkspaceID } from "@andesine/contracts/primitives";
import { and, eq } from "drizzle-orm";
import { db } from "../database";

interface RecoveryVersionGroup {
  contributorIDs: string[];
  version: typeof entryVersions.$inferSelect;
}

const publishMigrationRecoveryVersionEvents = async (
  migrationID: string,
  workspaceID: string,
  publish: (channel: string, message: string) => Promise<unknown>
): Promise<void> => {
  try {
    const rows = await db
      .select({
        contributorID: entryVersionContributors.membershipID,
        version: entryVersions
      })
      .from(schemaMigrationEntries)
      .innerJoin(entryVersions, eq(entryVersions.id, schemaMigrationEntries.recoveryVersionID))
      .leftJoin(entryVersionContributors, eq(entryVersionContributors.versionID, entryVersions.id))
      .where(
        and(
          eq(schemaMigrationEntries.workspaceID, workspaceID),
          eq(schemaMigrationEntries.migrationID, migrationID)
        )
      );
    const versionsByID = new Map<string, RecoveryVersionGroup>();

    for (const row of rows) {
      const group = versionsByID.get(row.version.id) || {
        contributorIDs: [],
        version: row.version
      };

      if (row.contributorID) group.contributorIDs.push(row.contributorID);

      versionsByID.set(row.version.id, group);
    }

    for (const group of versionsByID.values()) {
      await publish(
        `${toWorkspaceID(workspaceID)}:versions`,
        JSON.stringify({
          action: "version:create",
          data: mapVersionSummary(group.version, group.contributorIDs)
        })
      );
    }
  } catch (error) {
    console.error("Failed to publish schema migration recovery versions", {
      error,
      migrationID
    });
  }
};

export { publishMigrationRecoveryVersionEvents };
