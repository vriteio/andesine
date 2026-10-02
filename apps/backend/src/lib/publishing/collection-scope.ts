import { type createContentPaths } from "@andesine/server/content";
import { toUUID } from "@andesine/contracts/primitives";
import { ORPCError } from "@orpc/server";

type ContentPaths = Pick<ReturnType<typeof createContentPaths>, "descendantIDs">;

/**
 * The collection UUIDs that a publishable key can read: its collections and their descendants.
 * Without a scope, e.g. for secret keys, all collections can be read.
 */
const resolveCollectionScope = (
  paths: ContentPaths,
  collectionIDs: string[] | undefined
): Set<string> | undefined => {
  if (!collectionIDs) return undefined;

  return new Set(collectionIDs.map(toUUID).flatMap((id) => [id, ...paths.descendantIDs(id)]));
};
/** Refuses content outside a scope; entries at the workspace root are outside every scope. */
const assertInCollectionScope = (
  scope: Set<string> | undefined,
  collectionID: string | null
): void => {
  if (!scope || (collectionID !== null && scope.has(collectionID))) return;

  throw new ORPCError("FORBIDDEN", {
    message: "The publishable key cannot read this collection",
    data: { hints: ["Add the collection to the key in the Andesine app."] }
  });
};

export { resolveCollectionScope, assertInCollectionScope };
