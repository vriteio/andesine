interface PublishingWorkingCollection {
  deletedAt: Date | null;
  id: string;
  name: string;
  parentID: string | null;
  publishingEnabled: boolean;
  rank: string;
}
interface PublishingAcceptedCollection {
  id: string;
  name: string;
  parentID: string | null;
  publishedRoot: boolean;
  rank: string;
}
interface PublishingChangeSetCollection {
  accepted: PublishingAcceptedCollection | null;
  acceptedInScope: boolean;
  id: string;
  status: PublishingChangeStatus;
  structureChanged: boolean;
  treeParentID: string | null;
  working: PublishingWorkingCollection | null;
  workingInScope: boolean;
}
interface PublishingWorkingEntry {
  collectionID: string | null;
  deletedAt: Date | null;
  hash: string | null;
  id: string;
  name: string;
  rank: string;
  schemaRevisionID: string | null;
}
interface PublishingAcceptedEntry {
  collectionID: string | null;
  entryName: string;
  hash: string;
  publishedAt: Date;
  rank: string;
  schemaRevisionID: string | null;
  versionID: string;
}
interface PublishingChangeSetEntry {
  accepted: PublishingAcceptedEntry | null;
  acceptedInScope: boolean;
  contentChanged: boolean;
  documentChanged: boolean;
  id: string;
  nameChanged: boolean;
  schemaChanged: boolean;
  status: PublishingChangeStatus;
  structureChanged: boolean;
  working: PublishingWorkingEntry;
  workingInScope: boolean;
}
interface PublishingChangeSet {
  acceptedCollections: PublishingAcceptedCollection[];
  channel: string;
  collectionID: string;
  collections: PublishingChangeSetCollection[];
  entries: PublishingChangeSetEntry[];
  snapshotID: string;
  workingCollections: PublishingWorkingCollection[];
}
interface LoadPublishingChangeSetInput {
  channel: string;
  collectionID: string;
  expectedSnapshotID?: string;
}

type PublishingChangeStatus = "changes" | "pending-publish" | "pending-removal" | "published";

export type {
  LoadPublishingChangeSetInput,
  PublishingAcceptedCollection,
  PublishingAcceptedEntry,
  PublishingChangeSet,
  PublishingChangeSetCollection,
  PublishingChangeSetEntry,
  PublishingChangeStatus,
  PublishingWorkingCollection,
  PublishingWorkingEntry
};
