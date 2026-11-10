import { listPublishedCollections } from "./list-content";
import { getPublishedContentTree } from "./get-content-tree";
import { publishCollection } from "./publish";
import { setCollectionsPublishing } from "./set";
import { unpublishCollection } from "./unpublish";

const Collections = {
  listContent: listPublishedCollections,
  getContentTree: getPublishedContentTree,
  publish: publishCollection,
  set: setCollectionsPublishing,
  unpublish: unpublishCollection
};

export { Collections };
