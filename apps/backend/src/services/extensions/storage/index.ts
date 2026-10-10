import { deleteEntry } from "./delete";
import { getEntry } from "./get";
import { listEntries } from "./list";
import { setEntry } from "./set";

const storage = { get: getEntry, set: setEntry, delete: deleteEntry, list: listEntries };

export { storage };
