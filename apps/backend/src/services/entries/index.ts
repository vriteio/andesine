import { bulkMoveEntries } from "./bulk-move";
import { bulkUpdateEntries } from "./bulk-update";
import { createEntry } from "./create";
import { deleteEntries } from "./delete";
import { getEntry } from "./get";
import { listEntries } from "./list";
import { moveEntry } from "./move";
import { updateEntry } from "./update";

const Entries = {
  create: createEntry,
  get: getEntry,
  list: listEntries,
  delete: deleteEntries,
  update: updateEntry,
  bulkUpdate: bulkUpdateEntries,
  move: moveEntry,
  bulkMove: bulkMoveEntries
};

export { Entries };
