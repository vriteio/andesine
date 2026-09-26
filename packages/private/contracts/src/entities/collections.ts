import { id } from "../primitives/id";
import { collectionName } from "../content/name";
import * as z from "zod";

const collectionType = z.object({
  id: id().describe("ID of the collection"),
  name: collectionName().describe("Name of the collection"),
  restricted: z.boolean().describe("Whether the collection starts a restricted-access boundary"),
  ancestors: z.array(id().describe("IDs of ancestor collections")),
  descendants: z.array(id().describe("IDs of directly-descendant collections"))
});
type Collection = z.infer<typeof collectionType>;
export { collectionType };
export type { Collection };
