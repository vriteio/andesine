import { effectiveSchemaRevisions, entryVersionContributors, entryVersions } from "#backend/db";
import { getContentBlocks } from "#backend/lib/content";
import { mapVersionSummary } from "#backend/lib/data/entry-version";
import type { Database } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { assertRecordedContentRevision, mapSchemaRevision } from "#backend/lib/schema/recorded";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { loadPublishedAssets } from "./content-assets";
import type { publishedEntrySummaryType } from "#backend/contracts/schemas/content";
import type * as z from "zod";

type PublishedEntrySummary = z.infer<typeof publishedEntrySummaryType>;

const loadPublishedContentItems = async (
  database: Database,
  workspaceID: string,
  snapshotID: string,
  items: PublishedEntrySummary[]
) => {
  if (!items.length) return [];

  const versionIDs = items.map((item) => toUUID(item.version.id));
  const versions = await database
    .select()
    .from(entryVersions)
    .where(and(eq(entryVersions.workspaceID, workspaceID), inArray(entryVersions.id, versionIDs)));
  const revisionIDs = [
    ...new Set(
      versions.flatMap(({ schemaRevisionID }) => (schemaRevisionID ? [schemaRevisionID] : []))
    )
  ];
  const contributors = await database
    .select()
    .from(entryVersionContributors)
    .where(
      and(
        eq(entryVersionContributors.workspaceID, workspaceID),
        inArray(entryVersionContributors.versionID, versionIDs)
      )
    );
  const revisions = revisionIDs.length
    ? await database
        .select()
        .from(effectiveSchemaRevisions)
        .where(
          and(
            eq(effectiveSchemaRevisions.workspaceID, workspaceID),
            inArray(effectiveSchemaRevisions.id, revisionIDs)
          )
        )
    : [];
  const assets = await loadPublishedAssets(database, workspaceID, snapshotID, versions);
  const versionsByID = new Map(versions.map((version) => [version.id, version]));
  const revisionsByID = new Map(
    revisions.map((revision) => [revision.id, mapSchemaRevision(revision)])
  );
  const contributorsByVersion = new Map<string, string[]>();

  for (const contributor of contributors) {
    const ids = contributorsByVersion.get(contributor.versionID) || [];
    ids.push(contributor.membershipID);
    contributorsByVersion.set(contributor.versionID, ids);
  }

  return items.map((item) => {
    const version = versionsByID.get(toUUID(item.version.id));

    if (!version || version.entryID !== toUUID(item.id))
      throw new ORPCError("NOT_FOUND", { message: "Published entry version not found" });

    const schema = assertRecordedContentRevision(
      {
        document: version.document,
        entryID: version.entryID,
        versionID: version.id,
        schemaRevisionID: version.schemaRevisionID
      },
      version.schemaRevisionID ? revisionsByID.get(version.schemaRevisionID) || null : null
    );
    const { fragments, properties } = getContentBlocks(version.document);

    return {
      ...item,
      version: mapVersionSummary(version, contributorsByVersion.get(version.id) || []),
      content: version.document,
      fragments,
      properties,
      schema,
      assets: assets.get(version.id) || []
    };
  });
};

export { loadPublishedContentItems };
