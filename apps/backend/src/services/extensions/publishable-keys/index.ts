import { createPublishableKey } from "./create";
import { deletePublishableKey } from "./delete";
import { listPublishableKeys } from "./list";
import { updatePublishableKey } from "./update";

const publishableKeys = {
  create: createPublishableKey,
  delete: deletePublishableKey,
  list: listPublishableKeys,
  update: updatePublishableKey
};

export { publishableKeys };
