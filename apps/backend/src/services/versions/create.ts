import { retainVersionAssets } from "#backend/lib/assets/references";
import { getCurrentDocumentContent, type ContentSnapshot } from "#backend/collaboration";
import {
  contents,
  entries,
  entryVersionActivity,
  entryVersionActivityContributors,
  entryVersionContributors,
  entryVersions
} from "#backend/db";
import { getContentTitle } from "#backend/lib/content";
import { mapVersion, type VersionDetails, type VersionReason } from "#backend/lib/data";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { type ServiceResolveContext, withAuthorization } from "#backend/lib/policy";

interface CreateVersionInput {
  entryID: string;
  reason: VersionReason;
  contributorIDs: string[];
  name?: string;
  sourceVersionID?: string;
}
interface CommitCreateVersionInput extends CreateVersionInput {
  snapshot: ContentSnapshot;
}
interface ResolvedCreateVersion {
  collectionID: string | null;
}

const resolveCreateVersion = async (
  { database, input, workspaceID }: ServiceResolveContext<CreateVersionInput>,
  lockEntry = false
): Promise<ResolvedCreateVersion> => {
  const query = database
    .select({ collectionID: entries.collectionID })
    .from(entries)
    .where(
      and(
        eq(entries.id, toUUID(input.entryID)),
        eq(entries.workspaceID, workspaceID),
        isNull(entries.deletedAt)
      )
    );
  const [entry] = await (lockEntry ? query.for("update") : query);

  if (!entry) throw new ORPCError("NOT_FOUND", { message: "Entry not found" });

  return entry;
};
const commitCreateVersion = withAuthorization<
  CommitCreateVersionInput,
  ResolvedCreateVersion,
  VersionDetails
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "version:create", collectionID: resolved.collectionID }]
    }),
    resolve: (context) => resolveCreateVersion(context, true),
    transaction: "locked-workspace"
  },
  async ({ database, input, workspaceID }) => {
    const entryID = toUUID(input.entryID);
    const inputContributorIDs = input.contributorIDs.map(toUUID);
    const { snapshot } = input;
    const activityContributors =
      input.reason === "revert"
        ? []
        : await database
            .select({ membershipID: entryVersionActivityContributors.membershipID })
            .from(entryVersionActivityContributors)
            .where(eq(entryVersionActivityContributors.entryID, entryID));
    const contributorIDs = [
      ...new Set([
        ...inputContributorIDs,
        ...activityContributors.map(({ membershipID }) => membershipID)
      ])
    ];

    if (input.sourceVersionID) {
      const [source] = await database
        .select({ id: entryVersions.id })
        .from(entryVersions)
        .where(
          and(
            eq(entryVersions.id, toUUID(input.sourceVersionID)),
            eq(entryVersions.workspaceID, workspaceID),
            eq(entryVersions.entryID, entryID)
          )
        );

      if (!source) throw new ORPCError("NOT_FOUND", { message: "Source version not found" });
    }

    const [created] = await database
      .insert(entryVersions)
      .values({
        workspaceID,
        entryID,
        entryName: getContentTitle(snapshot.document),
        document: snapshot.document,
        hash: snapshot.hash,
        name: input.name,
        reason: input.reason,
        sourceVersionID: input.sourceVersionID ? toUUID(input.sourceVersionID) : null
      })
      .returning();

    await retainVersionAssets({
      database,
      workspaceID,
      entryID,
      versionID: created.id,
      sourceVersionID: input.sourceVersionID ? toUUID(input.sourceVersionID) : undefined,
      document: snapshot.document
    });

    if (contributorIDs.length > 0) {
      await database.insert(entryVersionContributors).values(
        contributorIDs.map((membershipID) => ({
          workspaceID,
          versionID: created.id,
          sourceVersionID: input.sourceVersionID ? toUUID(input.sourceVersionID) : undefined,
          membershipID
        }))
      );
    }

    const [content] = await database
      .select({ hash: contents.hash })
      .from(contents)
      .where(eq(contents.entryID, entryID));

    if (content?.hash === snapshot.hash) {
      await database.delete(entryVersionActivity).where(eq(entryVersionActivity.entryID, entryID));
    }

    return mapVersion(created, contributorIDs);
  }
);

const createVersion = withAuthorization<CreateVersionInput, ResolvedCreateVersion, VersionDetails>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "version:create", collectionID: resolved.collectionID }]
    }),
    resolve: resolveCreateVersion
  },
  async ({ auth, input, workspaceID }) => {
    const snapshot = await getCurrentDocumentContent(input.entryID, workspaceID);

    return commitCreateVersion({ ...input, auth, snapshot });
  }
);

export { commitCreateVersion, createVersion };
