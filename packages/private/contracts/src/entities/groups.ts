import { id } from "../primitives/id";
import * as z from "zod";

const groupType = z.object({
  id: id().describe("ID of the group"),
  name: z.string().min(1).max(50).describe("Name of the group")
});
type Group = z.infer<typeof groupType>;
export { groupType };
export type { Group };
