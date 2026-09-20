import { storeVersionProperties } from "#backend/lib/versioning/properties";
import { retainVersionAssets } from "#backend/lib/assets/references";
import {
  contents,
  entries,
  entryVersionActivity,
  entryVersionActivityContributors,
  entryVersionContributors,
  entryVersions,
  publishingSnapshotEntries,
  publishingSnapshots,
  workspaces
} from "#backend/db";
import { db } from "#backend/lib/adapters";
import { config } from "#backend/lib/config";
import { emitVersionDeletionEvents, emitVersionEvent } from "#backend/events/versions";
import { mapVersionSummary, type VersionSummary } from "#backend/lib/data/entry-version";
import { deletePublishingSnapshots } from "#backend/lib/publishing";
import { toEntryID, toVersionID, toWorkspaceID } from "#backend/lib/primitives";
import { and, desc, eq, inArray, isNull, lt, lte, notExists, sql } from "drizzle-orm";
import { AUTOMATIC_VERSION_QUEUE_INTERVAL_MS } from "./config";

interface ActivityCandidate {
  entryID: string;
  workspaceID: string;
  deletedAt: Date | null;
}

const AUTOMATIC_VERSION_BATCH_SIZE = 100;
const PUBLISHING_SNAPSHOT_CLEANUP_BATCH_SIZE = 100;
const VERSION_CLEANUP_WORKSPACE_BATCH_SIZE = 100;

let automaticVersionInterval: NodeJS.Timeout | undefined;
let automaticVersionRun: Promise<void> | undefined;

const processActivity = async (candidate: ActivityCandidate): Promise<void> => {
  if (candidate.deletedAt) {
    await db
      .delete(entryVersionActivity)
      .where(eq(entryVersionActivity.entryID, candidate.entryID));
    return;
  }

  const createdVersion = await db.transaction(async (tx): Promise<VersionSummary | null> => {
    const [workspace] = await tx
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.id, candidate.workspaceID), isNull(workspaces.deletingAt)))
      .for("update", { skipLocked: true });
    if (!workspace) return null;

    const [entry] = await tx
      .select({ id: entries.id, name: entries.name })
      .from(entries)
      .where(
        and(
          eq(entries.id, candidate.entryID),
          eq(entries.workspaceID, candidate.workspaceID),
          isNull(entries.deletedAt)
        )
      )
      .for("update", { skipLocked: true });

    if (!entry) return null;

    const [activity] = await tx
      .select({ entryID: entryVersionActivity.entryID })
      .from(entryVersionActivity)
      .where(
        and(
          eq(entryVersionActivity.entryID, candidate.entryID),
          lte(entryVersionActivity.dueAt, new Date())
        )
      )
      .for("update");

    if (!activity) return null;

    const [content] = await tx
      .select({
        document: contents.document,
        hash: contents.hash,
        schemaRevisionID: contents.schemaRevisionID
      })
      .from(contents)
      .where(eq(contents.entryID, candidate.entryID));
    const [latestVersion] = await tx
      .select({
        hash: entryVersions.hash,
        schemaRevisionID: entryVersions.schemaRevisionID
      })
      .from(entryVersions)
      .where(
        and(
          eq(entryVersions.workspaceID, candidate.workspaceID),
          eq(entryVersions.entryID, candidate.entryID)
        )
      )
      .orderBy(desc(entryVersions.createdAt))
      .limit(1);

    if (
      content?.document &&
      content.hash &&
      (latestVersion?.hash !== content.hash ||
        latestVersion.schemaRevisionID !== content.schemaRevisionID)
    ) {
      const [version] = await tx
        .insert(entryVersions)
        .values({
          workspaceID: candidate.workspaceID,
          entryID: candidate.entryID,
          entryName: entry.name,
          document: content.document,
          hash: content.hash,
          schemaRevisionID: content.schemaRevisionID,
          reason: "auto"
        })
        .returning();

      await storeVersionProperties({
        database: tx,
        workspaceID: candidate.workspaceID,
        versionID: version.id,
        document: content.document
      });
      await retainVersionAssets({
        database: tx,
        workspaceID: candidate.workspaceID,
        entryID: candidate.entryID,
        versionID: version.id,
        document: content.document
      });
      const contributors = await tx
        .select({ membershipID: entryVersionActivityContributors.membershipID })
        .from(entryVersionActivityContributors)
        .where(eq(entryVersionActivityContributors.entryID, candidate.entryID));

      if (contributors.length > 0) {
        await tx.insert(entryVersionContributors).values(
          contributors.map(({ membershipID }) => ({
            workspaceID: candidate.workspaceID,
            versionID: version.id,
            membershipID
          }))
        );
      }

      await tx
        .delete(entryVersionActivity)
        .where(eq(entryVersionActivity.entryID, candidate.entryID));

      return mapVersionSummary(
        version,
        contributors.map(({ membershipID }) => membershipID)
      );
    }

    await tx
      .delete(entryVersionActivity)
      .where(eq(entryVersionActivity.entryID, candidate.entryID));

    return null;
  });

  if (createdVersion) {
    emitVersionEvent(candidate.workspaceID, {
      action: "version:create",
      data: createdVersion
    });
  }
};
const deleteExpiredPublishingSnapshots = async (): Promise<void> => {
  const candidates = await db
    .select({ id: publishingSnapshots.id, workspaceID: publishingSnapshots.workspaceID })
    .from(publishingSnapshots)
    .where(lte(publishingSnapshots.expiresAt, new Date()))
    .orderBy(publishingSnapshots.expiresAt)
    .limit(PUBLISHING_SNAPSHOT_CLEANUP_BATCH_SIZE);

  for (const candidate of candidates) {
    await db.transaction(async (transaction) => {
      const [workspace] = await transaction
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, candidate.workspaceID))
        .for("update", { skipLocked: true });

      if (!workspace) return;

      const [snapshot] = await transaction
        .select({ id: publishingSnapshots.id })
        .from(publishingSnapshots)
        .where(
          and(
            eq(publishingSnapshots.id, candidate.id),
            eq(publishingSnapshots.workspaceID, candidate.workspaceID),
            lte(publishingSnapshots.expiresAt, new Date())
          )
        )
        .for("update", { skipLocked: true });

      if (!snapshot) return;

      await deletePublishingSnapshots(transaction, candidate.workspaceID, [snapshot.id]);
    });
  }
};
const deleteExpiredAutomaticVersions = async (): Promise<void> => {
  const candidates = await db.execute<{ workspaceID: string }>(sql`
    select distinct ${entryVersions.workspaceID} as "workspaceID"
    from ${entryVersions}
    inner join ${workspaces} on ${workspaces.id} = ${entryVersions.workspaceID}
    where ${entryVersions.reason} in ('auto', 'schema-migration')
      and not exists (
        select 1
        from ${publishingSnapshotEntries}
        where ${publishingSnapshotEntries.workspaceID} = ${entryVersions.workspaceID}
          and ${publishingSnapshotEntries.versionID} = ${entryVersions.id}
      )
      and ${entryVersions.createdAt} < now() - (
        case
          when ${!config.BILLING_ENABLED} or ${workspaces.subscriptionPlan} = 'pro'
            then ${config.PRO_VERSION_RETENTION_DAYS}::integer
          else ${config.VERSION_RETENTION_DAYS}::integer
        end * interval '1 day'
      )
    limit ${VERSION_CLEANUP_WORKSPACE_BATCH_SIZE}
  `);

  for (const candidate of candidates.rows) {
    const deleted = await db.transaction(async (transaction) => {
      const [workspace] = await transaction
        .select({ subscriptionPlan: workspaces.subscriptionPlan })
        .from(workspaces)
        .where(eq(workspaces.id, candidate.workspaceID))
        .for("update", { skipLocked: true });

      if (!workspace) return [];

      const retentionDays =
        !config.BILLING_ENABLED || workspace.subscriptionPlan === "pro"
          ? config.PRO_VERSION_RETENTION_DAYS
          : config.VERSION_RETENTION_DAYS;
      const expiresBefore = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      return transaction
        .delete(entryVersions)
        .where(
          and(
            eq(entryVersions.workspaceID, candidate.workspaceID),
            inArray(entryVersions.reason, ["auto", "schema-migration"]),
            lt(entryVersions.createdAt, expiresBefore),
            notExists(
              transaction
                .select({ versionID: publishingSnapshotEntries.versionID })
                .from(publishingSnapshotEntries)
                .where(
                  and(
                    eq(publishingSnapshotEntries.workspaceID, entryVersions.workspaceID),
                    eq(publishingSnapshotEntries.versionID, entryVersions.id)
                  )
                )
            )
          )
        )
        .returning({ entryID: entryVersions.entryID, id: entryVersions.id });
    });

    if (deleted.length === 0) continue;

    emitVersionDeletionEvents(
      toWorkspaceID(candidate.workspaceID),
      deleted.map((version) => ({
        entryID: toEntryID(version.entryID),
        id: toVersionID(version.id)
      }))
    );
  }
};
const runAutomaticVersionQueue = async (): Promise<void> => {
  const candidates = await db
    .select({
      entryID: entryVersionActivity.entryID,
      workspaceID: entryVersionActivity.workspaceID,
      deletedAt: entries.deletedAt
    })
    .from(entryVersionActivity)
    .innerJoin(
      entries,
      and(
        eq(entries.id, entryVersionActivity.entryID),
        eq(entries.workspaceID, entryVersionActivity.workspaceID)
      )
    )
    .where(lte(entryVersionActivity.dueAt, new Date()))
    .orderBy(entryVersionActivity.dueAt)
    .limit(AUTOMATIC_VERSION_BATCH_SIZE);

  for (const candidate of candidates) {
    try {
      await processActivity(candidate);
    } catch (error) {
      console.error("Failed to create an automatic version", {
        error,
        entryID: candidate.entryID
      });
    }
  }

  await deleteExpiredPublishingSnapshots();
  await deleteExpiredAutomaticVersions();
};
const checkAutomaticVersionQueue = (): void => {
  if (automaticVersionRun) return;

  automaticVersionRun = runAutomaticVersionQueue()
    .catch((error) => {
      console.error("Automatic version queue check failed", { error });
    })
    .finally(() => {
      automaticVersionRun = undefined;
    });
};
const startAutomaticVersionQueue = (): void => {
  if (automaticVersionInterval) return;

  checkAutomaticVersionQueue();
  automaticVersionInterval = setInterval(
    checkAutomaticVersionQueue,
    AUTOMATIC_VERSION_QUEUE_INTERVAL_MS
  );
  automaticVersionInterval.unref();
};
const stopAutomaticVersionQueue = async (): Promise<void> => {
  if (automaticVersionInterval) clearInterval(automaticVersionInterval);

  automaticVersionInterval = undefined;
  await automaticVersionRun;
};

export { startAutomaticVersionQueue, stopAutomaticVersionQueue };
