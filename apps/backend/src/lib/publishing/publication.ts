import { retainVersionAssets } from "#backend/lib/assets/references";
import {
  contents,
  entries,
  entryVersionActivity,
  entryVersionActivityContributors,
  entryVersionContributors,
  entryVersions
} from "#backend/db";
import type { db } from "#backend/lib/adapters";
import type { AuthorizedCollectionTree } from "#backend/lib/policy";
import { hashContentDocument, type ContentNode } from "#backend/lib/content";
import { mapVersionSummary, type VersionSummary } from "#backend/lib/data/entry-version";
import { toEntryID, toUUID, toVersionID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { commitPublishingSnapshot, type CommitPublishingSnapshotResult } from "./snapshot-commit";
import type { ResolvedCollectionSnapshotChanges } from "./snapshot-collection";
import { resolveEntrySnapshotChanges, type PublishingEntrySelection } from "./snapshot-entry";
import type { PublishingEntryStatus } from "./status";

interface PublishEntryTarget {
  entryID: string;
  versionID?: string;
}
interface PublishEntriesInput {
  authorization: AuthorizedCollectionTree;
  workspaceID: string;
  entries: PublishEntryTarget[];
  channel: string;
  contributorIDs: string[];
  creatorID?: string;
  snapshotOperations?: ResolvedCollectionSnapshotChanges;
  subscriptionPlan: string;
}
interface PublishEntriesResult {
  createdVersions: VersionSummary[];
  publishingEntries: PublishingEntryStatus[];
  publishedEntries: number;
  snapshot: CommitPublishingSnapshotResult | null;
}
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const EMPTY_DOCUMENT: ContentNode = { type: "doc", content: [] };
const lockPublishingEntries = async (
  tx: DatabaseTransaction,
  workspaceID: string,
  entryIDs: string[]
): Promise<void> => {
  if (entryIDs.length === 0) return;

  await tx
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceID, workspaceID),
        inArray(entries.id, entryIDs),
        isNull(entries.deletedAt)
      )
    )
    .orderBy(asc(entries.id))
    .for("update");
};
const publishEntries = async (
  tx: DatabaseTransaction,
  input: PublishEntriesInput
): Promise<PublishEntriesResult> => {
  const contributorIDs = [...new Set(input.contributorIDs.map(toUUID))];
  const entryIDs = input.entries.map((entry) => entry.entryID);
  const currentEntryIDs = input.entries.flatMap((entry) => {
    return entry.versionID ? [] : [entry.entryID];
  });
  const providedVersionIDs = input.entries.flatMap((entry) => {
    return entry.versionID ? [entry.versionID] : [];
  });

  if (input.entries.length === 0) {
    let snapshot: CommitPublishingSnapshotResult | null = null;

    if (input.snapshotOperations) {
      snapshot = await commitPublishingSnapshot(tx, {
        authorization: input.authorization,
        workspaceID: input.workspaceID,
        channelCode: input.channel,
        collectionChanges: input.snapshotOperations.collectionChanges,
        collectionRemovals: input.snapshotOperations.collectionRemovals,
        creatorID: input.creatorID,
        entryRemovals: input.snapshotOperations.entryRemovals,
        expectedSnapshotID: input.snapshotOperations.snapshotID,
        reason: "publish",
        subscriptionPlan: input.subscriptionPlan
      });
    }

    return { createdVersions: [], publishingEntries: [], publishedEntries: 0, snapshot };
  }

  const entryRows = await tx
    .select({
      id: entries.id,
      collectionID: entries.collectionID,
      name: entries.name,
      rank: entries.rank
    })
    .from(entries)
    .where(
      and(
        eq(entries.workspaceID, input.workspaceID),
        inArray(entries.id, entryIDs),
        isNull(entries.deletedAt)
      )
    )
    .orderBy(asc(entries.id))
    .for("update");

  if (entryRows.length !== input.entries.length) {
    throw new ORPCError("NOT_FOUND", { message: "Entry not found" });
  }

  const providedVersions =
    providedVersionIDs.length > 0
      ? await tx
          .select({
            id: entryVersions.id,
            entryID: entryVersions.entryID,
            entryName: entryVersions.entryName,
            hash: entryVersions.hash,
            document: entryVersions.document,
            schemaRevisionID: entryVersions.schemaRevisionID
          })
          .from(entryVersions)
          .where(
            and(
              eq(entryVersions.workspaceID, input.workspaceID),
              inArray(entryVersions.id, providedVersionIDs)
            )
          )
          .for("update")
      : [];
  const providedVersionsByID = new Map(providedVersions.map((version) => [version.id, version]));

  for (const target of input.entries) {
    if (!target.versionID) continue;

    const version = providedVersionsByID.get(target.versionID);

    if (!version || version.entryID !== target.entryID) {
      throw new ORPCError("NOT_FOUND", { message: "Version not found" });
    }
  }

  const contentRows = await tx
    .select({
      entryID: contents.entryID,
      document: contents.document,
      hash: contents.hash,
      schemaRevisionID: contents.schemaRevisionID
    })
    .from(contents)
    .where(inArray(contents.entryID, entryIDs));
  const latestVersions =
    currentEntryIDs.length > 0
      ? await tx
          .selectDistinctOn([entryVersions.entryID], {
            id: entryVersions.id,
            entryID: entryVersions.entryID,
            entryName: entryVersions.entryName,
            hash: entryVersions.hash,
            schemaRevisionID: entryVersions.schemaRevisionID
          })
          .from(entryVersions)
          .where(
            and(
              eq(entryVersions.workspaceID, input.workspaceID),
              inArray(entryVersions.entryID, currentEntryIDs)
            )
          )
          .orderBy(entryVersions.entryID, desc(entryVersions.createdAt), desc(entryVersions.id))
      : [];
  const activityContributors =
    currentEntryIDs.length > 0
      ? await tx
          .select({
            entryID: entryVersionActivityContributors.entryID,
            membershipID: entryVersionActivityContributors.membershipID
          })
          .from(entryVersionActivityContributors)
          .where(inArray(entryVersionActivityContributors.entryID, currentEntryIDs))
      : [];
  const contentByEntryID = new Map(contentRows.map((content) => [content.entryID, content]));
  const latestVersionByEntryID = new Map(
    latestVersions.map((version) => [version.entryID, version])
  );
  const targetsByEntryID = new Map(input.entries.map((entry) => [entry.entryID, entry]));
  const activityContributorsByEntryID = new Map<string, string[]>();
  const createdVersions: VersionSummary[] = [];
  const publishingSelections: PublishingEntrySelection[] = [];
  const publishingEntries: PublishingEntryStatus[] = [];

  for (const contributor of activityContributors) {
    const entryContributors = activityContributorsByEntryID.get(contributor.entryID) || [];

    entryContributors.push(contributor.membershipID);
    activityContributorsByEntryID.set(contributor.entryID, entryContributors);
  }

  for (const entry of entryRows) {
    const target = targetsByEntryID.get(entry.id)!;
    const content = contentByEntryID.get(entry.id);

    if (target.versionID) {
      const assignedVersion = providedVersionsByID.get(target.versionID)!;
      const draftHash = content?.hash || hashContentDocument(content?.document || EMPTY_DOCUMENT);
      const draftSchemaRevisionID = content?.schemaRevisionID || null;

      await retainVersionAssets({
        database: tx,
        workspaceID: input.workspaceID,
        entryID: entry.id,
        versionID: assignedVersion.id,
        document: assignedVersion.document
      });

      publishingSelections.push({
        entryID: entry.id,
        versionID: target.versionID,
        collectionID: entry.collectionID,
        rank: entry.rank
      });
      publishingEntries.push({
        entryID: toEntryID(entry.id),
        hasUnpublishedChanges:
          draftHash !== assignedVersion.hash ||
          entry.name !== assignedVersion.entryName ||
          draftSchemaRevisionID !== assignedVersion.schemaRevisionID,
        versionID: toVersionID(target.versionID)
      });
      continue;
    }

    const document = content?.document || EMPTY_DOCUMENT;
    const hash = content?.hash || hashContentDocument(document);
    const schemaRevisionID = content?.schemaRevisionID || null;
    const latestVersion = latestVersionByEntryID.get(entry.id);
    let versionID = latestVersion?.id;

    if (!content?.document || !content.hash) {
      await tx
        .insert(contents)
        .values({
          workspaceID: input.workspaceID,
          entryID: entry.id,
          document,
          hash
        })
        .onConflictDoUpdate({
          target: contents.entryID,
          set: { document, hash, updatedAt: new Date() }
        });
    }

    if (
      !latestVersion ||
      latestVersion.hash !== hash ||
      latestVersion.entryName !== entry.name ||
      latestVersion.schemaRevisionID !== schemaRevisionID
    ) {
      const [version] = await tx
        .insert(entryVersions)
        .values({
          workspaceID: input.workspaceID,
          entryID: entry.id,
          entryName: entry.name,
          document,
          hash,
          schemaRevisionID,
          reason: "manual"
        })
        .returning();
      const versionContributorIDs = [
        ...new Set([...contributorIDs, ...(activityContributorsByEntryID.get(entry.id) || [])])
      ];

      versionID = version.id;

      if (versionContributorIDs.length > 0) {
        await tx.insert(entryVersionContributors).values(
          versionContributorIDs.map((membershipID) => ({
            workspaceID: input.workspaceID,
            versionID: version.id,
            membershipID
          }))
        );
      }

      createdVersions.push(mapVersionSummary(version, versionContributorIDs));
    }

    if (!versionID) throw new Error("Failed to resolve a version for publishing");

    await retainVersionAssets({
      database: tx,
      workspaceID: input.workspaceID,
      entryID: entry.id,
      versionID,
      document
    });

    publishingSelections.push({
      entryID: entry.id,
      versionID,
      collectionID: entry.collectionID,
      rank: entry.rank
    });
    publishingEntries.push({
      entryID: toEntryID(entry.id),
      hasUnpublishedChanges: false,
      versionID: toVersionID(versionID)
    });
  }

  const snapshotChanges = await resolveEntrySnapshotChanges(tx, {
    workspaceID: input.workspaceID,
    channelCode: input.channel,
    entries: publishingSelections
  });
  const collectionChanges = new Map(
    snapshotChanges.collectionChanges.map((collection) => [collection.collectionID, collection])
  );

  for (const collection of input.snapshotOperations?.collectionChanges || []) {
    collectionChanges.set(collection.collectionID, collection);
  }

  if (
    input.snapshotOperations &&
    input.snapshotOperations.snapshotID !== snapshotChanges.snapshotID
  ) {
    throw new ORPCError("CONFLICT", { message: "Publishing snapshot changed" });
  }

  const snapshot = await commitPublishingSnapshot(tx, {
    authorization: input.authorization,
    workspaceID: input.workspaceID,
    channelCode: input.channel,
    collectionChanges: [...collectionChanges.values()],
    collectionRemovals: input.snapshotOperations?.collectionRemovals,
    creatorID: input.creatorID,
    entryChanges: snapshotChanges.entryChanges,
    entryRemovals: input.snapshotOperations?.entryRemovals,
    expectedSnapshotID: input.snapshotOperations?.snapshotID || snapshotChanges.snapshotID,
    reason: "publish",
    subscriptionPlan: input.subscriptionPlan
  });

  if (currentEntryIDs.length > 0) {
    await tx
      .delete(entryVersionActivity)
      .where(inArray(entryVersionActivity.entryID, currentEntryIDs));
  }

  return { createdVersions, publishingEntries, publishedEntries: entryRows.length, snapshot };
};

export { lockPublishingEntries, publishEntries };
export type { PublishEntryTarget };
