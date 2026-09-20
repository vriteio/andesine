import { entries } from "#backend/db";
import type { VersionDetails } from "#backend/lib/data/entry-version";
import {
  loadPublishedEntryVersion,
  type PublishedEntryVersionInput,
  type PublishedEntryVersionSource
} from "#backend/lib/publishing/entry-version";
import { getVersionDetails } from "#backend/lib/versioning/details";
import { withAuthorization } from "#backend/lib/policy";
import { toUUID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

interface GetPublishedEntryVersionInput extends PublishedEntryVersionInput {
  entryID: string;
  expectedSchemaHash?: string;
}

const getPublishedEntryVersion = withAuthorization<
  GetPublishedEntryVersionInput,
  PublishedEntryVersionSource,
  VersionDetails
>(
  {
    actions: ({ resolved }) => ({
      entries: [{ action: "publishing:read", collectionID: resolved.collectionID }]
    }),
    includeDeleted: true,
    resolve: async ({ database, input, workspaceID }) => {
      const source = await loadPublishedEntryVersion(database, workspaceID, input);
      const [entry] = await database
        .select({ collectionID: entries.collectionID })
        .from(entries)
        .where(and(eq(entries.id, toUUID(input.entryID)), eq(entries.workspaceID, workspaceID)));

      if (!entry) {
        throw new ORPCError("NOT_FOUND", { message: "Published entry version not found" });
      }

      return { ...source, collectionID: entry.collectionID };
    }
  },
  async ({ database, input, resolved }) =>
    getVersionDetails(database, resolved.version, resolved.contributorIDs, input.expectedSchemaHash)
);
export { getPublishedEntryVersion };
