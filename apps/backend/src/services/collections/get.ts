import { loadCurrentContentPaths } from "@andesine/server/content";
import { type CollectionSelector } from "@andesine/contracts/content";
import { toCollectionID, toUUID } from "@andesine/contracts/primitives";
import { type Collection } from "@andesine/contracts/entities";
import { ORPCError } from "@orpc/server";
import { withAuthorization } from "#backend/lib/policy";

/** One collection by ID, path, or slug path, e.g. to name a collection that an extension gets. */
const getCollection = withAuthorization<
  CollectionSelector,
  {
    paths: Awaited<ReturnType<typeof loadCurrentContentPaths>>;
    collectionID: string | null | undefined;
  },
  Collection & { path: string; slugPath: string }
>(
  {
    actions: ({ resolved }) => ({
      collections: [{ action: "collection:read", collectionID: resolved.collectionID }]
    }),
    resolve: async ({ database, input, workspaceID }) => {
      const paths = await loadCurrentContentPaths(database, workspaceID);

      return { paths, collectionID: paths.resolveCollection(input, true) };
    },
    transaction: "atomic",
    tree: true
  },
  async ({ authorization, resolved }) => {
    const collectionID = resolved.collectionID && toCollectionID(resolved.collectionID);
    const collection = authorization.collections.find(({ id }) => id === collectionID);

    if (!collection) throw new ORPCError("NOT_FOUND", { message: "Collection not found" });

    return {
      ...collection,
      path: resolved.paths.collectionPath(toUUID(collection.id)),
      slugPath: resolved.paths.collectionSlugPath(toUUID(collection.id))
    };
  }
);

export { getCollection };
