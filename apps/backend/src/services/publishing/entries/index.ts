import { getPublishedEntrySchema } from "./get-schema";
import { listPublishedEntries } from "./list-content";
import { getPublishedEntryContent } from "./get-content";
import { getPublishedEntryVersion } from "./get-version";
import { listEntryPublications } from "./list-publications";
import { publishEntry } from "./publish";
import { unpublishEntry } from "./unpublish";

const Entries = {
  listContent: listPublishedEntries,
  getSchema: getPublishedEntrySchema,
  getContent: getPublishedEntryContent,
  getVersion: getPublishedEntryVersion,
  listPublications: listEntryPublications,
  publish: publishEntry,
  unpublish: unpublishEntry
};

export { Entries };
