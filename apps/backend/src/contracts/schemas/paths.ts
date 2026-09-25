import type {
  CollectionSelector,
  EntrySelector,
  PublishedEntrySelector
} from "#backend/lib/content/paths";
import { parseContentPath } from "#backend/lib/content/paths";
import { publicID } from "#backend/lib/primitives";
import * as z from "zod";

const contentPathType = z
  .string()
  .refine(
    (path) => {
      try {
        parseContentPath(path);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Use an absolute path or a collection-ID anchor with valid name segments" }
  )
  .describe(
    "Decoded content path, such as /Docs/Page or coll_ID/Page. Names are case-sensitive. Do not URL-encode names before passing them to the SDK."
  );
const contentSlugPathType = z
  .string()
  .refine(
    (path) => {
      try {
        parseContentPath(path, true);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Use an absolute slug path or a collection-ID anchor with valid segments" }
  )
  .describe(
    "Decoded derived slug path, such as /docs/getting-started or coll_ID/getting-started. Use the returned slugPath without URL encoding."
  );
const entrySelectorShape = {
  id: publicID("ent").optional(),
  path: contentPathType.optional(),
  slugPath: contentSlugPathType.optional()
};
const publishedEntrySelectorShape = {
  entryID: publicID("ent").optional(),
  path: contentPathType.optional(),
  slugPath: contentSlugPathType.optional()
};
const collectionSelectorShape = {
  collectionID: publicID("coll").optional(),
  collectionPath: contentPathType.optional(),
  collectionSlugPath: contentSlugPathType.optional()
};
const selectorCount = (...values: Array<string | undefined>): number =>
  values.filter((value) => value !== undefined).length;
const hasEntrySelector = (input: EntrySelector) =>
  selectorCount(input.id, input.path, input.slugPath) === 1;
const hasPublishedEntrySelector = (input: PublishedEntrySelector) =>
  selectorCount(input.entryID, input.path, input.slugPath) === 1;
const hasCollectionSelector = (input: CollectionSelector) =>
  selectorCount(input.collectionID, input.collectionPath, input.collectionSlugPath) === 1;
const hasOptionalCollectionSelector = (input: CollectionSelector) =>
  selectorCount(input.collectionID, input.collectionPath, input.collectionSlugPath) <= 1;

export {
  contentPathType,
  contentSlugPathType,
  entrySelectorShape,
  publishedEntrySelectorShape,
  collectionSelectorShape,
  hasEntrySelector,
  hasPublishedEntrySelector,
  hasCollectionSelector,
  hasOptionalCollectionSelector
};
