import { entries, entryVersionContributors, entryVersions } from "@andesine/server/database";
import { getVersionDetails } from "#backend/lib/versioning/details";
import {
  encodeEntryMDX,
  loadEntryReferences,
  withEntryLinkPaths,
  type EntryReferences
} from "#backend/lib/content";
import { type VersionDetails } from "@andesine/contracts/versions";
import { type ServiceResolveContext, withAuthorization } from "#backend/lib/policy";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";

interface GetVersionInput {
  versionID: string;
  expectedSchemaHash?: string;
  action?: "version:read" | "version:revert";
  format?: "json" | "mdx";
}
interface GetVersionResult extends VersionDetails {
  mdx?: string;
  references: EntryReferences;
}

type ResolvedGetVersion = Awaited<ReturnType<typeof resolveGetVersion>>;

async function resolveGetVersion({
  database,
  input,
  workspaceID
}: ServiceResolveContext<GetVersionInput>) {
  const versionID = toUUID(input.versionID);
  const [row] = await database
    .select({ collectionID: entries.collectionID, version: entryVersions })
    .from(entryVersions)
    .innerJoin(
      entries,
      and(
        eq(entries.workspaceID, entryVersions.workspaceID),
        eq(entries.id, entryVersions.entryID),
        input.action === "version:revert" ? isNull(entries.deletedAt) : undefined
      )
    )
    .where(and(eq(entryVersions.id, versionID), eq(entryVersions.workspaceID, workspaceID)));

  if (!row) throw new ORPCError("NOT_FOUND", { message: "Version not found" });

  return row;
}

const getVersion = withAuthorization<GetVersionInput, ResolvedGetVersion, GetVersionResult>(
  {
    actions: ({ input, resolved }) => ({
      entries: [
        {
          action: input.action || "version:read",
          collectionID: resolved.collectionID
        }
      ]
    }),
    includeDeleted: true,
    tree: true,
    resolve: resolveGetVersion
  },
  async ({ authorization, database, input, resolved, workspaceID }) => {
    const versionID = toUUID(input.versionID);
    const contributors = await database
      .select({ membershipID: entryVersionContributors.membershipID })
      .from(entryVersionContributors)
      .where(
        and(
          eq(entryVersionContributors.workspaceID, workspaceID),
          eq(entryVersionContributors.versionID, versionID)
        )
      );

    const details = await getVersionDetails(
      database,
      resolved.version,
      contributors.map(({ membershipID }) => membershipID),
      input.expectedSchemaHash
    );

    const references = await loadEntryReferences(
      database,
      workspaceID,
      details.document,
      authorization
    );

    if (input.format !== "mdx") return { ...details, references };

    return {
      ...details,
      references,
      mdx: await encodeEntryMDX(withEntryLinkPaths(details.document, references))
    };
  }
);

export { getVersion };
