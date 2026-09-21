import { createContentPaths } from "#backend/lib/content/paths";
import type { AuthorizedCollectionTree } from "#backend/lib/policy";
import { publicID } from "#backend/lib/primitives";

interface MetadataCollectionRow {
  id: string;
  parentID: string | null;
  name: string;
  rank: string;
}
interface MetadataCollectionSource extends Omit<MetadataCollectionRow, "id"> {
  id: string | null;
}
interface MetadataSelectionInput {
  rows: MetadataCollectionRow[];
  selectors: string[];
  rootID?: string;
  authorization?: AuthorizedCollectionTree;
}

/** Resolve selectors in the selected source, then filter descendants by current access if needed. */
const selectMetadataCollections = ({
  rows,
  selectors,
  rootID,
  authorization
}: MetadataSelectionInput) => {
  const paths = createContentPaths(rows, rootID);
  const selectedIDs = new Set<string | null>();
  const scopes = selectors.length
    ? selectors.map(
        (selector) =>
          paths.resolveCollection(
            publicID("coll").safeParse(selector).success
              ? { collectionID: selector }
              : { collectionPath: selector }
          ) ?? null
      )
    : [null];

  for (const scope of scopes) {
    if (authorization) authorization.assertCollectionAction(scope, "collection:read");

    selectedIDs.add(scope);
    for (const id of paths.descendantIDs(scope)) selectedIDs.add(id);
  }

  const collections: MetadataCollectionSource[] = [
    { id: null, parentID: null, name: "", rank: "" },
    ...rows
      .filter((row) => row.id !== rootID)
      .map((row) => ({
        ...row,
        parentID: row.parentID === rootID ? null : row.parentID
      }))
  ].filter(
    (row) =>
      selectedIDs.has(row.id) &&
      (!authorization || authorization.canCollection(row.id, "collection:read"))
  );

  return { collections, paths };
};

export { selectMetadataCollections };
export type { MetadataCollectionRow, MetadataCollectionSource };
