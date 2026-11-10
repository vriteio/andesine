import { type PublishingChannelContentEntry } from "#web/lib/data";

interface PublishingPanelEntryOccurrence {
  canPublish: boolean;
  canRevert: boolean;
  canUnpublish: boolean;
  deleted: boolean;
  entryID: string;
  id: string;
  kind: PublishingPanelEntryOccurrenceKind;
  moved: boolean;
  name: string;
  rank: string;
  status: PublishingChannelContentEntry["status"];
  treeCollectionID: string | null;
  versionID: string | null;
}

type PublishingPanelEntryOccurrenceKind = "accepted" | "working";

export type { PublishingPanelEntryOccurrence, PublishingPanelEntryOccurrenceKind };
