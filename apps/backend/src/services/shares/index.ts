import { createShareLink } from "./create-link";
import { getCurrentShare } from "./current";
import { deleteShares } from "./delete";
import { getShareAsset } from "./get-asset";
import { inviteToEntry } from "./invite";
import { joinShare } from "./join";
import { listShares } from "./list";
import { listSharedEntries } from "./list-entries";
import { listIdentifiedVisitors } from "./list-visitors";
import { listShareExtensions } from "./list-extensions";
import { listenToShareEvents } from "./listen";
import { getSharingPolicy, updateSharingPolicy } from "./policy";
import { renameVisitor } from "./rename";
import { updateShare } from "./update";

const Shares = {
  createLink: createShareLink,
  current: getCurrentShare,
  deleteMany: deleteShares,
  getAsset: getShareAsset,
  getPolicy: getSharingPolicy,
  invite: inviteToEntry,
  join: joinShare,
  list: listShares,
  listEntries: listSharedEntries,
  listVisitors: listIdentifiedVisitors,
  listExtensions: listShareExtensions,
  listen: listenToShareEvents,
  rename: renameVisitor,
  update: updateShare,
  updatePolicy: updateSharingPolicy
};

export { Shares };
