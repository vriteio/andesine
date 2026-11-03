import { getEntryStates } from "./get-entry-states";
import { getExplorerOverlay } from "./get-explorer-overlay";
import { getExplorerTree } from "./get-explorer-tree";
import { getPublishingStatus } from "./get-publishing-status";
import { listenToWorkspaceEvents } from "./listen-to-workspace-events";

const Sync = {
  getEntryStates,
  getExplorerOverlay,
  getExplorerTree,
  getPublishingStatus,
  listenToWorkspaceEvents
};

export { Sync };
