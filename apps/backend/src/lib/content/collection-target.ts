import { type DatabaseTransaction as Database } from "@andesine/server/database";
import { loadCurrentContentPaths } from "@andesine/server/content";
import { toUUID } from "@andesine/contracts/primitives";
import { type ContentPaths } from "./links";

interface CollectionTargetSelector {
  collectionID?: string | null;
  collectionPath?: string;
  collectionSlugPath?: string;
}

/** @returns The collection UUID, null for the top level, or undefined without a selector. */
const resolveCollectionTarget = async (
  database: Database,
  workspaceID: string,
  selector: CollectionTargetSelector,
  loadedPaths?: ContentPaths
): Promise<string | null | undefined> => {
  const { collectionID, collectionPath, collectionSlugPath } = selector;

  if (collectionPath === undefined && collectionSlugPath === undefined) {
    return collectionID ? toUUID(collectionID) : collectionID;
  }

  const paths = loadedPaths ?? (await loadCurrentContentPaths(database, workspaceID));
  const resolvedID = paths.resolveCollection({ collectionPath, collectionSlugPath });

  return resolvedID === paths.rootID ? null : (resolvedID ?? null);
};

export { resolveCollectionTarget };
