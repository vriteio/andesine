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
const entrySelectorShape = { id: publicID("ent").optional(), path: contentPathType.optional() };
const publishedEntrySelectorShape = {
  entryID: publicID("ent").optional(),
  path: contentPathType.optional()
};
const collectionSelectorShape = {
  collectionID: publicID("coll").optional(),
  collectionPath: contentPathType.optional()
};
const hasEntrySelector = (input: { id?: string; path?: string }) =>
  (input.id !== undefined) !== (input.path !== undefined);
const hasPublishedEntrySelector = (input: { entryID?: string; path?: string }) =>
  (input.entryID !== undefined) !== (input.path !== undefined);
const hasCollectionSelector = (input: { collectionID?: string; collectionPath?: string }) =>
  (input.collectionID !== undefined) !== (input.collectionPath !== undefined);
const hasOptionalCollectionSelector = (input: { collectionID?: string; collectionPath?: string }) =>
  input.collectionID === undefined || input.collectionPath === undefined;

export {
  contentPathType,
  entrySelectorShape,
  publishedEntrySelectorShape,
  collectionSelectorShape,
  hasEntrySelector,
  hasPublishedEntrySelector,
  hasCollectionSelector,
  hasOptionalCollectionSelector
};
