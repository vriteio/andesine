import { id } from "../primitives/id";
import { entryName } from "../content/name";
import * as z from "zod";
import { LexoRank } from "lexorank";

const lexoRank = () => {
  return z
    .string()
    .max(255)
    .refine(
      (value) => {
        try {
          return `${LexoRank.parse(value)}` === value;
        } catch {
          return false;
        }
      },
      { error: "Invalid LexoRank" }
    );
};
const entryType = z.object({
  id: id().describe("ID of the entry"),
  name: entryName().describe("Name of the entry"),
  order: lexoRank().describe("LexoRank order of the entry"),
  collectionID: id().optional().describe("ID of the collection this entry belongs to")
});
type Entry = z.infer<typeof entryType>;
export { entryType, lexoRank };
export type { Entry };
