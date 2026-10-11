import {
  contents,
  entries,
  entryVersionActivity,
  entryVersionActivityContributors,
  entryVersionContributors,
  entryVersions
} from "@andesine/server/database";
import { storeVersionProperties } from "@andesine/server/versioning";
import { retainVersionAssets } from "@andesine/server/assets";
import { getContentTitle, type ContentNode } from "@andesine/document";
import { getVersionDetails } from "#backend/lib/versioning/details";
import {
  decodeEntryMDX,
  getMDXImageURLs,
  loadEntryReferences,
  prepareEntryContent,
  withEntryLinkPaths,
  type ImageAssetIDs
} from "#backend/lib/content";
import { Asset } from "#backend/services/assets";
import {
  getCurrentDocumentContent,
  getLoadedDocumentContent,
  type ContentSnapshot
} from "#backend/collaboration";
import { type VersionDetails, type VersionReason } from "@andesine/contracts/versions";
import { toUUID } from "@andesine/contracts/primitives";
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
  schemaRevisionID?: string | null;
  snapshot: ContentSnapshot;
}
interface CommitContentVersionInput extends CreateVersionInput {
  document?: ContentNode;
  mdx?: string;
  imageAssetIDs?: ImageAssetIDs;
}
interface CreateVersionFromInput extends CreateVersionInput {
  document?: ContentNode;
  mdx?: string;
}
interface ResolvedCreateVersion {
  collectionID: string | null;
}
interface ResolvedContentVersion extends ResolvedCreateVersion {
  document: ContentNode | null;
  schemaRevisionID: string | null;
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
    const [content] = await database
      .select({ hash: contents.hash, schemaRevisionID: contents.schemaRevisionID })
      .from(contents)
      .where(eq(contents.entryID, entryID));
    const schemaRevisionID =
      input.schemaRevisionID === undefined
        ? (content?.schemaRevisionID ?? null)
        : input.schemaRevisionID
          ? toUUID(input.schemaRevisionID)
          : null;
    const activityContributors =
      input.reason === "revert" || input.reason === "import"
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
        schemaRevisionID,
        sourceVersionID: input.sourceVersionID ? toUUID(input.sourceVersionID) : null
      })
      .returning();

    await storeVersionProperties({
      database,
      workspaceID,
      versionID: created.id,
      document: snapshot.document
    });

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

    if (content?.hash === snapshot.hash) {
      await database.delete(entryVersionActivity).where(eq(entryVersionActivity.entryID, entryID));
    }

    return getVersionDetails(database, created, contributorIDs);
  }
);

const commitContentVersion = withAuthorization<
  CommitContentVersionInput,
  ResolvedContentVersion,
  VersionDetails
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "version:create", collectionID: resolved.collectionID }]
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const [entry] = await database
        .select({
          collectionID: entries.collectionID,
          document: contents.document,
          schemaRevisionID: contents.schemaRevisionID
        })
        .from(entries)
        .innerJoin(contents, eq(contents.entryID, entries.id))
        .where(
          and(
            eq(entries.id, toUUID(input.entryID)),
            eq(entries.workspaceID, workspaceID),
            isNull(entries.deletedAt)
          )
        )
        .for("update", { of: entries });

      if (!entry) throw new ORPCError("NOT_FOUND", { message: "Entry not found" });

      return entry;
    },
    transaction: "locked-workspace",
    tree: true
  },
  async ({ auth, authorization, authorizationScope, database, input, resolved, workspaceID }) => {
    const { document, mdx, imageAssetIDs, ...versionInput } = input;
    // Not through a connection: closing one in this transaction would wait for its own save.
    const storedBase = getLoadedDocumentContent(input.entryID)?.document ??
      resolved.document ?? { type: "doc", content: [] };
    const base = withEntryLinkPaths(
      storedBase,
      await loadEntryReferences(database, workspaceID, storedBase, authorization)
    );
    const { state: _state, ...snapshot } = await prepareEntryContent(database, workspaceID, {
      authorization,
      entryID: input.entryID,
      schemaRevisionID: resolved.schemaRevisionID,
      document: document ?? (await decodeEntryMDX(mdx!, base, imageAssetIDs))
    });

    await Asset.grantContent({
      auth,
      entryID: input.entryID,
      document: snapshot.document,
      previousDocument: storedBase,
      skipAuthorization: authorizationScope
    });

    return commitCreateVersion({
      ...versionInput,
      auth,
      schemaRevisionID: resolved.schemaRevisionID,
      snapshot,
      skipAuthorization: authorizationScope
    });
  }
);

/** Saves a version of the current content, or of the supplied document, which is validated. */
const createVersion = withAuthorization<
  CreateVersionFromInput,
  ResolvedCreateVersion,
  VersionDetails
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "version:create", collectionID: resolved.collectionID }]
    }),
    resolve: resolveCreateVersion
  },
  async ({ auth, input, workspaceID }) => {
    const { document, mdx, ...versionInput } = input;

    if (document || mdx !== undefined) {
      const imageURLs = await getMDXImageURLs(mdx === undefined ? [] : [mdx]);
      const imageAssetIDs = imageURLs.length
        ? await Asset.importContentImages({ auth, entryID: input.entryID, urls: imageURLs })
        : undefined;

      return commitContentVersion({ ...versionInput, auth, document, mdx, imageAssetIDs });
    }

    const snapshot = await getCurrentDocumentContent(input.entryID, workspaceID);

    return commitCreateVersion({ ...versionInput, auth, snapshot });
  }
);

export { commitCreateVersion, createVersion };
