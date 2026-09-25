import { toContentSlug } from "@andesine/sdk/slug";
import { entryVersions } from "#backend/db/versions";
import { normalizeCollectionName, normalizeEntryName } from "#backend/lib/validation/content-name";
import { toCollectionID, toEntryID } from "#backend/lib/primitives";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "#backend/lib/policy";
import type {
  PublishingSnapshotCollectionState,
  PublishingSnapshotEntryState
} from "./snapshot-validation";

const assertSnapshotNames = async (
  database: Database,
  workspaceID: string,
  collections: PublishingSnapshotCollectionState[],
  entries: PublishingSnapshotEntryState[]
): Promise<void> => {
  const versionIDs = [...new Set(entries.map((entry) => entry.versionID))];
  const versions = versionIDs.length
    ? await database
        .select({
          id: entryVersions.id,
          entryID: entryVersions.entryID,
          name: entryVersions.entryName
        })
        .from(entryVersions)
        .where(
          and(eq(entryVersions.workspaceID, workspaceID), inArray(entryVersions.id, versionIDs))
        )
    : [];
  const versionsByID = new Map(versions.map((version) => [version.id, version]));
  const names = new Set<string>();
  const items = [
    ...collections.map((collection) => ({
      id: toCollectionID(collection.collectionID),
      name: normalizeCollectionName(collection.name),
      storedName: collection.name,
      parentID: collection.parentID
    })),
    ...entries.map((entry) => {
      const version = versionsByID.get(entry.versionID);

      if (!version || version.entryID !== entry.entryID)
        throw new ORPCError("NOT_FOUND", { message: "Snapshot entry version not found" });
      return {
        id: toEntryID(entry.entryID),
        name: normalizeEntryName(version.name),
        storedName: version.name,
        parentID: entry.collectionID
      };
    })
  ];

  for (const item of items) {
    const keys = [toContentSlug(item.name, item.id), `name:${item.name}`].map((name) =>
      JSON.stringify([item.parentID, name])
    );

    if (item.name !== item.storedName)
      throw new ORPCError("BAD_REQUEST", {
        message: "Published names must be trimmed and NFC-normalized"
      });
    if (keys.some((key) => names.has(key))) {
      throw new ORPCError("PUBLISHING_NAME_CONFLICT", {
        status: 409,
        message: "Published entries and collections must have unique sibling names and URL slugs",
        data: {
          name: item.name,
          slug: toContentSlug(item.name, item.id),
          parentID: item.parentID ? toCollectionID(item.parentID) : null,
          hints: [
            "Check the names in the assigned versions and snapshot collections. Publish the required replacements together, or unpublish the conflicting item first. Renaming a draft alone does not change an existing publication."
          ]
        }
      });
    }
    keys.forEach((key) => names.add(key));
  }
};

export { assertSnapshotNames };
